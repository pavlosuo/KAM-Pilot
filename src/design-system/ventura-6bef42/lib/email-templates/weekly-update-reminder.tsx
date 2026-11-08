import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface WeeklyUpdateReminderEmailProps {
  siteName: string;
  siteUrl: string;
  recipientName?: string;
  startupName: string;
  updateUrl: string;
}

export const WeeklyUpdateReminderEmail = ({
  siteName,
  siteUrl,
  recipientName,
  startupName,
  updateUrl,
}: WeeklyUpdateReminderEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Don't forget to publish this week's update for {startupName}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>This week's update is still pending</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName},` : "Hi there,"}
        </Text>
        <Text style={text}>
          You haven't published your weekly update for{" "}
          <strong>{startupName}</strong> yet. Share what you've worked on this
          week so your team and supporters on{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>{" "}
          stay in the loop.
        </Text>
        <Button style={button} href={updateUrl}>
          Publish weekly update
        </Button>
        <Text style={footer}>
          You're getting this reminder because you're on the {startupName} team.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WeeklyUpdateReminderEmail;

import type { TemplateEntry } from "./registry";

export const template = {
  component: WeeklyUpdateReminderEmail,
  subject: (data: Record<string, any>) =>
    `Reminder: publish this week's update for ${data.startupName ?? "your startup"}`,
  displayName: "Weekly update reminder",
  previewData: {
    siteName: "Ventura",
    siteUrl: "https://venturafund.eu",
    recipientName: "Alex",
    startupName: "Acme",
    updateUrl: "https://venturafund.eu/startups/preview-id",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#000000",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 20px",
};
const link = { color: "inherit", textDecoration: "underline" };
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
  display: "inline-block",
  margin: "10px 0 25px",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
