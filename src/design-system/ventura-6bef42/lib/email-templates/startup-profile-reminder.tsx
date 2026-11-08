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

interface StartupProfileReminderEmailProps {
  siteName: string;
  siteUrl: string;
  recipientName?: string;
  createStartupUrl: string;
}

export const StartupProfileReminderEmail = ({
  siteName,
  siteUrl,
  recipientName,
  createStartupUrl,
}: StartupProfileReminderEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Add your startup profile on {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ready to add your startup?</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName},` : "Hi there,"}
        </Text>
        <Text style={text}>
          Your founder profile on{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>{" "}
          is live, but you haven't created a startup profile yet. Adding your
          startup takes a couple of minutes and lets your team, supporters, and
          investors follow along with your progress.
        </Text>
        <Button style={button} href={createStartupUrl}>
          Create your startup profile
        </Button>
        <Text style={footer}>
          You're getting this one-time reminder because you completed your
          founder profile on {siteName}.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default StartupProfileReminderEmail;

import type { TemplateEntry } from "./registry";

export const template = {
  component: StartupProfileReminderEmail,
  subject: "Add your startup profile on Ventura",
  displayName: "Startup profile reminder",
  previewData: {
    siteName: "Ventura",
    siteUrl: "https://venturafund.eu",
    recipientName: "Alex",
    createStartupUrl: "https://venturafund.eu/startups/new",
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
