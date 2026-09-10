import { createServerFn } from "@tanstack/react-start";
import { sendTestStoreEmail } from "./emails.server";

export const testEmailDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    if (!data.email || !data.email.includes("@")) {
      throw new Error("Please enter a valid email address");
    }
    return data;
  })
  .handler(async ({ data }) => {
    return await sendTestStoreEmail(data.email);
  });
