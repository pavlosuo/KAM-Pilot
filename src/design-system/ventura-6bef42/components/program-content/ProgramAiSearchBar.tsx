import { useState } from "react";
import { Target, AlertTriangle, BarChart2, Handshake, Users } from "lucide-react";
import { OrbInput, type OrbAction } from "@/design-system/ventura-6bef42/components/ui/animated-input";
import { FounderAiChat } from "@/design-system/ventura-6bef42/components/program-content/FounderAiChat";

const FOUNDER_ACTIONS: OrbAction[] = [
  {
    id: "goal",
    label: "Set a goal for this week",
    icon: <Target className="h-4 w-4 text-green-500" />,
    description: "Goals",
    end: "Action",
  },
  {
    id: "behind",
    label: "Where are we falling behind?",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    description: "Progress",
    end: "Insight",
  },
  {
    id: "summary",
    label: "Summarise our program progress",
    icon: <BarChart2 className="h-4 w-4 text-blue-500" />,
    description: "Program",
    end: "Report",
  },
  {
    id: "investor",
    label: "Are we ready to raise?",
    icon: <Handshake className="h-4 w-4 text-purple-500" />,
    description: "Fundraising",
    end: "Check",
  },
  {
    id: "challenge",
    label: "Help me improve my pitch",
    icon: <Users className="h-4 w-4 text-orange-500" />,
    description: "Pitch",
    end: "Assist",
  },
];

export function ProgramAiSearchBar({
  programName,
  startupId,
  programId,
  startupName,
  onOpenChange,
}: {
  programName: string;
  startupId: string;
  programId: string;
  startupName: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const ask = (text?: string) => {
    setPrompt(text?.trim() ? text.trim() : null);
    setNonce((n) => n + 1);
    setChatOpen(true);
  };

  return (
    <>
      <OrbInput
        className="py-0 min-h-0"
        actions={FOUNDER_ACTIONS}
        onSubmit={(value: string) => ask(value)}
        onActionSelect={(action: OrbAction) => ask(action.label)}
        onLogoClick={() => ask()}
        onOpenChange={onOpenChange}
        inlineDropdown
      />
      <FounderAiChat
        startupId={startupId}
        programId={programId}
        startupName={startupName || programName}
        open={chatOpen}
        onOpenChange={(v) => {
          setChatOpen(v);
          if (!v) setPrompt(null);
        }}
        initialPrompt={prompt}
        promptNonce={nonce}
      />
    </>
  );
}
