import { initShell } from "../shell.js";
export const ready = Promise.resolve(initShell({ isPrivate: false }));
