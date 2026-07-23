import type { InvoicesData } from "../types";
import raw from "./invoices-data.json";

export const seedData = raw as unknown as InvoicesData;
