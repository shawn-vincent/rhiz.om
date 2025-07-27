import { db } from "~/server/db";
import { BeingService } from "./being-service";
import { IntentionService } from "./intention-service";
import { AuthService } from "./auth-service";

// Service factory - creates service instances with database dependency
export const createServices = () => ({
  being: new BeingService(db),
  intention: new IntentionService(db),
  auth: new AuthService(db),
});

// Type for the services object
export type Services = ReturnType<typeof createServices>;

// Singleton instance for use across the application
export const services = createServices();