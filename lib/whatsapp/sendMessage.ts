import "server-only";

type SendWhatsAppTextMessageResult = {
  ok: boolean;
  messageId?: string;
  status?: number;
  error?: string;
  raw?: unknown;
};

function getWhatsAppApiVersion() {
  return process.env.WHATSAPP_API_VERSION || "v25.0";
}

export async function sendWhatsAppTextMessage(
  phone: string,
  message: string
): Promise<SendWhatsAppTextMessageResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.error(
      "[whatsapp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID environment variable."
    );
    return {
      ok: false,
      error: "Missing WhatsApp environment variables.",
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${getWhatsAppApiVersion()}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    );

    const raw = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[whatsapp] Message send failed.", {
        status: response.status,
        phone,
        error: raw,
      });

      return {
        ok: false,
        status: response.status,
        error: "WhatsApp API request failed.",
        raw,
      };
    }

    const messageId =
      raw &&
      typeof raw === "object" &&
      "messages" in raw &&
      Array.isArray((raw as { messages?: unknown[] }).messages)
        ? ((raw as { messages: Array<{ id?: string }> }).messages[0]?.id ?? undefined)
        : undefined;

    return {
      ok: true,
      status: response.status,
      messageId,
      raw,
    };
  } catch (error) {
    console.error("[whatsapp] Unexpected send error.", {
      phone,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: false,
      error: "Unexpected WhatsApp send error.",
    };
  }
}
