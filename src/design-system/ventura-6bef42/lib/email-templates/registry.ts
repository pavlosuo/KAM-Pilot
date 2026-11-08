import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as teammateInviteTemplate } from './teammate-invite'
import { template as weeklyUpdateReminderTemplate } from './weekly-update-reminder'
import { template as startupProfileReminderTemplate } from './startup-profile-reminder'
import { template as challengeDeadlineReminderTemplate } from './challenge-deadline-reminder'
import { template as inboxItemTemplate } from './inbox-item'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'teammate-invite': teammateInviteTemplate,
  'weekly-update-reminder': weeklyUpdateReminderTemplate,
  'startup-profile-reminder': startupProfileReminderTemplate,
  'challenge-deadline-reminder': challengeDeadlineReminderTemplate,
  'inbox-item': inboxItemTemplate,
}


