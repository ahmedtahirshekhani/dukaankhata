export interface EvolutionSessionResponse {
  status: "disconnected" | "qrcode" | "connected";
  qrcode?: string;
  connectedPhone?: string;
  error?: string;
}

export class EvolutionWhatsAppClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Create or fetch session QR Code for a shop instance
   */
  async getSessionStatus(instanceName: string): Promise<EvolutionSessionResponse> {
    if (!this.isConfigured()) {
      return {
        status: "disconnected",
        error: "EVOLUTION_API_URL or EVOLUTION_API_KEY is not configured on the server."
      };
    }

    try {
      // Fetch connection state
      const stateRes = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { "apikey": this.apiKey },
        cache: "no-store",
      });

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData?.instance?.state === "open") {
          return {
            status: "connected",
            connectedPhone: stateData?.instance?.owner || undefined,
          };
        }
      }

      // Fetch or request new QR code
      const connectRes = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
        headers: { "apikey": this.apiKey },
        cache: "no-store",
      });

      if (connectRes.ok) {
        const connectData = await connectRes.json();
        const base64Qr = connectData?.code || connectData?.base64 || connectData?.qrcode?.base64;
        if (base64Qr) {
          return {
            status: "qrcode",
            qrcode: base64Qr.startsWith("data:image") ? base64Qr : `data:image/png;base64,${base64Qr}`
          };
        }
      }

      return { status: "disconnected" };
    } catch (err: any) {
      console.error("Error fetching Evolution WhatsApp session status:", err);
      return { status: "disconnected", error: err?.message || "Failed to connect to gateway" };
    }
  }

  /**
   * Create a new instance for a shop
   */
  async createInstance(instanceName: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const res = await fetch(`${this.baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        }),
      });

      return res.ok;
    } catch (err) {
      console.error("Failed to create WhatsApp instance:", err);
      return false;
    }
  }

  /**
   * Disconnect & logout an instance
   */
  async disconnectInstance(instanceName: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const res = await fetch(`${this.baseUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: { "apikey": this.apiKey }
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to disconnect instance:", err);
      return false;
    }
  }

  /**
   * Send text message directly through the shop owner's connected WhatsApp session
   */
  async sendTextMessage(instanceName: string, toPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: "WhatsApp Gateway not configured on server" };
    }

    try {
      // Normalize number format (ensure digits only, E.164 without leading +)
      let cleanedPhone = toPhone.replace(/\D/g, "");
      if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
        cleanedPhone = `92${cleanedPhone.slice(1)}`;
      }

      const res = await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify({
          number: cleanedPhone,
          text: text,
          options: {
            delay: 1200,
            presence: "composing"
          }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data?.key?.id };
      } else {
        const errText = await res.text();
        return { success: false, error: errText };
      }
    } catch (err: any) {
      console.error("Error sending text via Evolution API:", err);
      return { success: false, error: err?.message || "Send failed" };
    }
  }
}
