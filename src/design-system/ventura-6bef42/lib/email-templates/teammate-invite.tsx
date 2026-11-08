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

interface TeammateInviteEmailProps {
  siteName: string;
  siteUrl: string;
  inviterName: string;
  startupName: string;
  acceptUrl: string;
}

export const TeammateInviteEmail = ({
  siteName,
  siteUrl,
  inviterName,
  startupName,
  acceptUrl,
}: TeammateInviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {inviterName} invited you to join {startupName} on {siteName}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're invited to join {startupName}</Heading>
        <Text style={text}>
          <strong>{inviterName}</strong> added you as a teammate on{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          . Accept the invitation to appear on the {startupName} team page.
        </Text>
        <Button style={button} href={acceptUrl}>
          Accept invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default TeammateInviteEmail;

import type { TemplateEntry } from "./registry";

export const template = {
  component: TeammateInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data.inviterName ?? "A teammate"} invited you to join ${data.startupName ?? "their startup"} on ${data.siteName ?? "Ventura"}`,
  displayName: "Teammate invitation",
  previewData: {
    siteName: "Ventura",
    siteUrl: "https://venturafund.eu",
    inviterName: "Alex",
    startupName: "Acme",
    acceptUrl: "https://venturafund.eu/invite/accept?token=preview",
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
  margin: "0 0 25px",
};
const link = { color: "inherit", textDecoration: "underline" };
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
