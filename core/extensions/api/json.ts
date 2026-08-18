import { z } from "zod";

/** JSON data allowed to cross an extension-host boundary. */
export type ExtensionJsonValue =
  | string
  | number
  | boolean
  | null
  | ExtensionJsonValue[]
  | { [key: string]: ExtensionJsonValue };

export type ExtensionJsonObject = {
  [key: string]: ExtensionJsonValue;
};

export const ExtensionJsonValueSchema: z.ZodType<ExtensionJsonValue> = z.lazy(
  () =>
    z.union([
      z.string(),
      z.number().finite(),
      z.boolean(),
      z.null(),
      z.array(ExtensionJsonValueSchema),
      z.record(z.string(), ExtensionJsonValueSchema),
    ]),
);

export const ExtensionJsonObjectSchema: z.ZodType<ExtensionJsonObject> =
  z.record(z.string(), ExtensionJsonValueSchema);
