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

interface ChallengeDeadlineReminderEmailProps {
  siteName: string;
  siteUrl: string;
  recipientName?: string;
  startupName: string;
  programName: string;
  challengeTitle: string;
  dueDate: string;
  progressLabel?: string;
  challengeUrl: string;
  calendarUrl?: string;
}

export const ChallengeDeadlineReminderEmail = ({
  siteName,
  siteUrl,
  recipientName,
  startupName,
  programName,
  challengeTitle,
  dueDate,
  progressLabel,
  challengeUrl,
  calendarUrl,
}: ChallengeDeadlineReminderEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {challengeTitle} is due tomorrow — submit it for review
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your challenge is due tomorrow</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName},` : "Hi there,"}
        </Text>
        <Text style={text}>
          The challenge <strong>{challengeTitle}</strong> from{" "}
          <strong>{programName}</strong> is due on <strong>{dueDate}</strong>{" "}
          and hasn't been submitted for lead review yet for{" "}
          <strong>{startupName}</strong>.
        </Text>
        {progressLabel ? (
          <Text style={text}>Current progress: {progressLabel}</Text>
        ) : null}
        <Button style={button} href={challengeUrl}>
          Submit for check
        </Button>
        {calendarUrl ? (
          <Text style={text}>
            <Link href={calendarUrl} style={link}>
              Add this deadline to Google Calendar
            </Link>
          </Text>
        ) : null}
        <Text style={footer}>
          You're getting this reminder because you're on the {startupName} team
          on{" "}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ChallengeDeadlineReminderEmail;

import type { TemplateEntry } from "./registry";

export const template = {
  component: ChallengeDeadlineReminderEmail,
  subject: (data: Record<string, any>) =>
    `Due tomorrow: ${data.challengeTitle ?? "your challenge"}`,
  displayName: "Challenge deadline reminder",
  previewData: {
    siteName: "Ventura",
    siteUrl: "https://venturafund.eu",
    recipientName: "Alex",
    startupName: "Acme",
    programName: "Katalyst",
    challengeTitle: "Let's get 100 calls today",
    dueDate: "2026-08-14",
    progressLabel: "29 / 100 calls",
    challengeUrl: "https://venturafund.eu/program-content",
    calendarUrl:
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Challenge+due&dates=20260814T090000Z/20260814T100000Z",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container = {
  padding: "32px 24px",
  maxWidth: "560px",
  margin: "0 auto",
};

const h1 = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#111827",
  margin: "0 0 16px",
};

const text = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#374151",
  margin: "0 0 14px",
};

const link = { color: "#dc2626", textDecoration: "underline" };

const button = {
  backgroundColor: "#dc2626",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  padding: "12px 20px",
  display: "inline-block",
  margin: "8px 0 20px",
};

const footer = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  margin: "16px 0 0",
};
