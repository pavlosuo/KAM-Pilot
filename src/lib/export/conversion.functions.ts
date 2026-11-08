import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { conversionInput } from "./conversion";

export const convertPowerPoint = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => conversionInput.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return { ok: false as const, error: "Conversion requests must come from this app." };
    }
    const gateway = process.env["LOVABLE_API_KEY"];
    const connection = process.env["UDC_CLOUDCONVERT_API_KEY"];
    if (!gateway || !connection) return { ok: false as const, error: "CloudConvert is not connected. Download PDF instead." };
    try {
      const { convertPresentation } = await import("./conversion.server");
      const result = await convertPresentation(data, { gateway, connection });
      return { ok: true as const, file: result.file };
    } catch (error) {
      console.error("PowerPoint conversion failed", error);
      return { ok: false as const, error: error instanceof Error ? error.message : "PowerPoint conversion failed. Download PDF instead." };
    }
  });