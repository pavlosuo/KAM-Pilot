import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface InboxItemEmailProps {
  siteName?: string;
  siteUrl?: string;
  recipientName?: string;
  kindLabel?: string;
  title?: string;
  body?: string;
  context?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
}

export const InboxItemEmail = ({
  siteName = "Ventura",
  siteUrl = "https://venturafund.eu",
  recipientName,
  kindLabel = "Update",
  title = "You have a new item in your inbox",
  body = "",
  context,
  linkUrl,
  linkLabel = "Open document",
}: InboxItemEmailProps) => {
  const titleLower = title.toLowerCase();
  const kindLower = kindLabel.toLowerCase();
  const previewText = titleLower.startsWith(kindLower) ? title : `${kindLabel}: ${title}`;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>
          {kindLabel}
          {context ? ` · ${context}` : ""}
        </Text>
        <Heading style={heading}>{title}</Heading>
        <Text style={paragraph}>
          {recipientName ? `Hi ${recipientName},` : "Hi there,"} you have a new item in your{" "}
          {siteName} inbox.
        </Text>
        {body ? (
          <Section style={quote}>
            <Text style={quoteText}>{body}</Text>
          </Section>
        ) : null}
        {linkUrl ? (
          <Text style={paragraph}>
            <Link href={linkUrl} style={link}>
              {linkLabel}
            </Link>
          </Text>
        ) : null}
        <Text style={paragraph}>
          <Link href={siteUrl} style={link}>
            Open {siteName}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          You are receiving this because inbox email notifications are on in your {siteName}{" "}
          settings.
        </Text>
      </Container>
    </Body>
  </Html>
  );
};

export const template = {
  component: InboxItemEmail,
  subject: (data: Record<string, any>) => {
    const kind = String(data?.kindLabel ?? "Update");
    const title = String(data?.title ?? "New inbox item");
    const titleLower = title.toLowerCase();
    const kindLower = kind.toLowerCase();
    return titleLower.startsWith(kindLower) ? title : `${kind}: ${title}`;
  },
  displayName: "Inbox notification",
  previewData: {
    recipientName: "Jane",
    kindLabel: "Announcement",
    title: "Demo day is next Thursday",
    body: "Please confirm your attendance by Friday.",
    context: "Ignite Program",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#6b7280",
  margin: "0 0 6px",
};
const heading = { fontSize: "22px", lineHeight: "1.3", color: "#111827", margin: "0 0 14px" };
const paragraph = { fontSize: "15px", lineHeight: "1.6", color: "#374151", margin: "0 0 14px" };
const quote = {
  borderLeft: "3px solid #111827",
  padding: "6px 0 6px 14px",
  margin: "0 0 18px",
};
const quoteText = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#111827",
  margin: "0",
  whiteSpace: "pre-wrap" as const,
};
const link = { color: "#111827", fontWeight: 600, textDecoration: "underline" };
const hr = { borderColor: "#e5e7eb", margin: "22px 0" };
const footer = { fontSize: "12px", lineHeight: "1.5", color: "#9ca3af", margin: "0" };
