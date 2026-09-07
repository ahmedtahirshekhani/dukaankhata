if (typeof process !== "undefined") {
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
}

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
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

/**
 * MongoDB-backed Baileys Auth State Store
 * Persists credentials & keys directly to MongoDB (whatsapp_auth_keys collection)
 * so WhatsApp connections stay 100% active across Vercel redeployments & server restarts.
 */
async function getMongoDBAuthState(shopId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const shopObjId = toObjectId(shopId);
  const keysCol = await getCollection(COLLECTIONS.WHATSAPP_AUTH_KEYS);

  // 1. Read creds document
  const credsDoc = await keysCol.findOne({ shop_id: shopObjId, key_id: "creds" });
  let creds: any;
  if (credsDoc?.data) {
    try {
      creds = JSON.parse(credsDoc.data, BufferJSON.reviver);
    } catch (e) {
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // 2. Function to save creds
  const saveCreds = async () => {
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    await keysCol.updateOne(
      { shop_id: shopObjId, key_id: "creds" },
      {
        $set: {
          shop_id: shopObjId,
          key_id: "creds",
          data: serialized,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: any } = {};
          const keyIds = ids.map(id => `${type}-${id}`);
          const docs = await keysCol.find({
            shop_id: shopObjId,
            key_id: { $in: keyIds }
          }).toArray();

          for (const doc of docs) {
            if (doc.data) {
              try {
                const value = JSON.parse(doc.data, BufferJSON.reviver);
                const actualId = doc.key_id.substring(type.length + 1);
                data[actualId] = value;
              } catch (e) {}
            }
          }
          return data;
        },
        set: async (data: any) => {
          const bulkOps: any[] = [];
          for (const category in data) {
            const categoryObj = data[category];
            if (categoryObj && typeof categoryObj === "object") {
              for (const id in categoryObj) {
                const value = categoryObj[id];
                const keyId = `${category}-${id}`;
                if (value) {
                  const serialized = JSON.stringify(value, BufferJSON.replacer);
                  bulkOps.push({
                    updateOne: {
                      filter: { shop_id: shopObjId, key_id: keyId },
                      update: {
                        $set: {
                          shop_id: shopObjId,
                          key_id: keyId,
                          data: serialized,
                          updated_at: new Date()
                        }
                      },
                      upsert: true
                    }
                  });
                } else {
                  bulkOps.push({
                    deleteOne: {
                      filter: { shop_id: shopObjId, key_id: keyId }
                    }
                  });
                }
              }
            }
          }
          if (bulkOps.length > 0) {
            await keysCol.bulkWrite(bulkOps);
          }
        }
      }
    },
    saveCreds
  };
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
      // Use MongoDB-backed Auth State Store for permanent multi-tenant persistence
      const { state, saveCreds } = await getMongoDBAuthState(shopId);
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

      if (state.creds?.me) {
        (sock as any).user = state.creds.me;
      }

      this.activeSockets.set(shopId, sock);

      // Check if credentials in MongoDB are already authenticated
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
            const keysCol = await getCollection(COLLECTIONS.WHATSAPP_AUTH_KEYS);
            await keysCol.deleteMany({ shop_id: toObjectId(shopId) });

            await sessionsCol.updateOne(
              { shop_id: toObjectId(shopId) },
              { $set: { status: "disconnected", connected_phone: null, qrcode: null, updated_at: new Date() } }
            );
          } else if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
            // Immediate reconnect after initial QR pairing code 515
            this.activeSockets.delete(shopId);
            this.getOrStartShopSession(shopId);
          } else if (shouldReconnect) {
            this.activeSockets.delete(shopId);
            setTimeout(() => this.getOrStartShopSession(shopId), 2000);
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

      const keysCol = await getCollection(COLLECTIONS.WHATSAPP_AUTH_KEYS);
      await keysCol.deleteMany({ shop_id: toObjectId(shopId) });

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

      // Wait for sock.user to be set if socket is restoring from MongoDB credentials
      let attempts = 0;
      while (!sock?.user && attempts < 25) {
        await new Promise((r) => setTimeout(r, 400));
        sock = this.activeSockets.get(shopId) || sock;
        attempts++;
      }

      if (!sock.user) {
        return { success: false, error: "WhatsApp session is initializing. Please try sending again in a few seconds." };
      }

      // Format customer phone to JID (e.g. 923001234567@s.whatsapp.net)
      let cleanedPhone = toPhone.replace(/\D/g, "");
      if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
        cleanedPhone = `92${cleanedPhone.slice(1)}`;
      } else if (cleanedPhone.length === 10 && cleanedPhone.startsWith("3")) {
        cleanedPhone = `92${cleanedPhone}`;
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
