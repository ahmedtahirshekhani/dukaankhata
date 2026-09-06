if (typeof process !== "undefined") {
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
}

import makeWASocket, {
  useMultiFileAuthState as baileysMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import os from "os";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

interface ActiveSession {
  socket: WASocket;
  shopId: string;
  connectedPhone?: string;
}

class BaileysEngineManager {
  private activeSockets: Map<string, WASocket> = new Map();
  private isInitializing: Map<string, boolean> = new Map();

  private getSessionsDir(): string {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const baseDir = isVercel ? os.tmpdir() : process.cwd();
    const dir = path.join(baseDir, "whatsapp-sessions");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Initialize or retrieve an active WhatsApp Web socket session for a shop
   */
  async getOrStartShopSession(shopId: string, forceRefreshQr = false): Promise<{ status: "connected" | "qrcode" | "disconnected"; qrcode?: string; connectedPhone?: string }> {
    const instanceName = `shop_${shopId}`;
    const sessionsCol = await getCollection(COLLECTIONS.WHATSAPP_SESSIONS);

    // 1. Check if socket is already active in memory
    const existingSocket = this.activeSockets.get(shopId);
    if (existingSocket && !forceRefreshQr) {
      const userJid = existingSocket.user?.id;
      if (userJid) {
        const phone = userJid.split(":")[0].replace(/\D/g, "");
        return { status: "connected", connectedPhone: phone };
      }
      // If socket exists and is in middle of connecting, don't spawn duplicate socket
      const doc = await sessionsCol.findOne({ shop_id: toObjectId(shopId) });
      return {
        status: (doc?.status as any) || "disconnected",
        qrcode: doc?.qrcode || undefined,
        connectedPhone: doc?.connected_phone || undefined,
      };
    }

    // 2. If forceRefreshQr requested and we have active socket, end existing socket to avoid conflict
    if (forceRefreshQr && existingSocket) {
      this.activeSockets.delete(shopId);
      try {
        await existingSocket.logout().catch(() => {});
      } catch (e) {}
    }

    // 3. Check initialization lock
    if (this.isInitializing.get(shopId) && !forceRefreshQr) {
      const doc = await sessionsCol.findOne({ shop_id: toObjectId(shopId) });
      return {
        status: (doc?.status as any) || "disconnected",
        qrcode: doc?.qrcode || undefined,
        connectedPhone: doc?.connected_phone || undefined,
      };
    }

    this.isInitializing.set(shopId, true);

    try {
      const sessionPath = path.join(this.getSessionsDir(), instanceName);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { state, saveCreds } = await baileysMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as any }));

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ["DukaanKhata Web", "Chrome", "1.0.0"],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        fireInitQueries: false,
        connectTimeoutMs: 15000,
        defaultQueryTimeoutMs: 15000,
        keepAliveIntervalMs: 25000,
        getMessage: async () => undefined,
      });

      this.activeSockets.set(shopId, sock);

      // Check if credentials on disk are already authenticated
      if (state.creds?.me?.id) {
        const userJid = state.creds.me.id;
        const phone = userJid.split(":")[0].replace(/\D/g, "");
        await sessionsCol.updateOne(
          { shop_id: toObjectId(shopId) },
          {
            $set: {
              instance_name: instanceName,
              status: "connected",
              connected_phone: phone,
              qrcode: null,
              updated_at: new Date(),
            }
          },
          { upsert: true }
        );
      }

      // Listen for credentials update
      sock.ev.on("creds.update", saveCreds);

      // Listen for connection update
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const base64DataUrl = await QRCode.toDataURL(qr);
            await sessionsCol.updateOne(
              { shop_id: toObjectId(shopId) },
              {
                $set: {
                  instance_name: instanceName,
                  status: "qrcode",
                  qrcode: base64DataUrl,
                  updated_at: new Date(),
                },
                $setOnInsert: {
                  shop_id: toObjectId(shopId),
                  auto_reminder_enabled: false,
                  min_overdue_days: 1,
                  reminder_time: "10:00",
                  created_at: new Date(),
                }
              },
              { upsert: true }
            );
          } catch (qrErr) {
            console.error("Failed to generate Base64 QR code:", qrErr);
          }
        }

        if (connection === "open" || sock.user?.id) {
          const userJid = sock.user?.id || state.creds?.me?.id || "";
          const phone = userJid.split(":")[0].replace(/\D/g, "");

          console.log(`WhatsApp Session connected for shop ${shopId} (Phone: +${phone})`);
          this.activeSockets.set(shopId, sock);

          await sessionsCol.updateOne(
            { shop_id: toObjectId(shopId) },
            {
              $set: {
                instance_name: instanceName,
                status: "connected",
                connected_phone: phone,
                qrcode: null,
                updated_at: new Date(),
              }
            },
            { upsert: true }
          );
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

          console.log(`WhatsApp connection closed for shop ${shopId}. Code: ${statusCode}, Reconnect: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            this.activeSockets.delete(shopId);
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
            await sessionsCol.updateOne(
              { shop_id: toObjectId(shopId) },
              { $set: { status: "disconnected", connected_phone: null, qrcode: null, updated_at: new Date() } }
            );
          } else if (shouldReconnect) {
            setTimeout(() => this.getOrStartShopSession(shopId), 5000);
          }
        }
      });

      this.isInitializing.delete(shopId);

      const currentDoc = await sessionsCol.findOne({ shop_id: toObjectId(shopId) });
      return {
        status: (currentDoc?.status as any) || (state.creds?.me ? "connected" : "disconnected"),
        qrcode: currentDoc?.qrcode || undefined,
        connectedPhone: currentDoc?.connected_phone || (state.creds?.me?.id ? state.creds.me.id.split(":")[0].replace(/\D/g, "") : undefined),
      };

    } catch (err: any) {
      console.error(`Error starting Baileys session for shop ${shopId}:`, err);
      this.isInitializing.delete(shopId);
      return { status: "disconnected" };
    }
  }

  /**
   * Disconnect and clean up session
   */
  async disconnectShopSession(shopId: string): Promise<boolean> {
    try {
      const sock = this.activeSockets.get(shopId);
      if (sock) {
        await sock.logout().catch(() => {});
        this.activeSockets.delete(shopId);
      }

      const instanceName = `shop_${shopId}`;
      const sessionPath = path.join(this.getSessionsDir(), instanceName);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      const sessionsCol = await getCollection(COLLECTIONS.WHATSAPP_SESSIONS);
      await sessionsCol.updateOne(
        { shop_id: toObjectId(shopId) },
        { $set: { status: "disconnected", connected_phone: null, qrcode: null, updated_at: new Date() } }
      );

      return true;
    } catch (err) {
      console.error(`Error disconnecting session for shop ${shopId}:`, err);
      return false;
    }
  }

  /**
   * Send a text message to a customer from the shop owner's connected WhatsApp session
   */
  async sendTextMessage(shopId: string, toPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let sock = this.activeSockets.get(shopId);

      // If socket is not in memory, attempt starting/restoring session
      if (!sock) {
        await this.getOrStartShopSession(shopId);
        sock = this.activeSockets.get(shopId);
      }

      if (!sock) {
        return { success: false, error: "WhatsApp session is not connected for this shop. Please scan the QR code first." };
      }

      // Format customer phone to JID (e.g. 923001234567@s.whatsapp.net)
      let cleanedPhone = toPhone.replace(/\D/g, "");
      if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
        cleanedPhone = `92${cleanedPhone.slice(1)}`;
      }
      const recipientJid = `${cleanedPhone}@s.whatsapp.net`;

      // Dispatch message (override getUrlInfo in options parameter to avoid getLinkPreview bundling error)
      const result = await sock.sendMessage(
        recipientJid,
        { text },
        { getUrlInfo: () => Promise.resolve(undefined) } as any
      );

      return {
        success: true,
        messageId: result?.key?.id || undefined
      };
    } catch (err: any) {
      console.error(`Failed to send WhatsApp message for shop ${shopId}:`, err);
      return { success: false, error: err?.message || "Failed to send message" };
    }
  }
}

// Global singleton instance across Next.js reloads
declare global {
  var _baileysEngineManager: BaileysEngineManager | undefined;
}

export const baileysEngine = global._baileysEngineManager || new BaileysEngineManager();
if (process.env.NODE_ENV !== "production") {
  global._baileysEngineManager = baileysEngine;
}
