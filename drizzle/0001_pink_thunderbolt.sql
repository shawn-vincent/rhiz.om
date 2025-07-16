CREATE TABLE "rhiz.om_being" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" varchar(50) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"modifiedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ownerId" varchar(255),
	"locationId" varchar(255),
	"extIds" jsonb,
	"idHistory" jsonb,
	"metadata" jsonb,
	"properties" jsonb,
	"content" jsonb
);
--> statement-breakpoint
CREATE TABLE "rhiz.om_intention" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" varchar(50) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"modifiedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ownerId" varchar(255) NOT NULL,
	"locationId" varchar(255) NOT NULL,
	"state" varchar(50) NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rhiz.om_post" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rhiz.om_post" CASCADE;--> statement-breakpoint
ALTER TABLE "rhiz.om_user" ADD COLUMN "beingId" varchar(255);--> statement-breakpoint
ALTER TABLE "rhiz.om_being" ADD CONSTRAINT "rhiz.om_being_ownerId_rhiz.om_being_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."rhiz.om_being"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhiz.om_being" ADD CONSTRAINT "rhiz.om_being_locationId_rhiz.om_being_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."rhiz.om_being"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhiz.om_intention" ADD CONSTRAINT "rhiz.om_intention_ownerId_rhiz.om_being_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."rhiz.om_being"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhiz.om_intention" ADD CONSTRAINT "rhiz.om_intention_locationId_rhiz.om_being_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."rhiz.om_being"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intention_owner_idx" ON "rhiz.om_intention" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "intention_location_idx" ON "rhiz.om_intention" USING btree ("locationId");--> statement-breakpoint
ALTER TABLE "rhiz.om_user" ADD CONSTRAINT "rhiz.om_user_beingId_rhiz.om_being_id_fk" FOREIGN KEY ("beingId") REFERENCES "public"."rhiz.om_being"("id") ON DELETE no action ON UPDATE no action;