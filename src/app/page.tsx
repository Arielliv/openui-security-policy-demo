"use client";
import "@openuidev/react-ui/styles/index.css";

import { PolicyProgressPanel, PolicySummaryPanel } from "@/components/policy-workbench";
import {
  AgentInterface,
  fetchLLM,
  useSystemThemeMode,
  vercelAIAdapter,
  vercelAIMessageFormat,
} from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";

const llm = fetchLLM({
  url: "/api/chat",
  streamAdapter: vercelAIAdapter(),
  messageFormat: vercelAIMessageFormat,
});

export default function Home() {
  const mode = useSystemThemeMode();

  return (
    <main className="app-shell">
      <AgentInterface
        llm={llm}
        componentLibrary={openuiLibrary}
        agentName="Aegis Policy Assistant"
        theme={{ mode }}
        starterVariant="short"
        starters={[
          { displayText: "Start a production policy", prompt: "Help me create a production security identity policy for an AI agent." },
          { displayText: "Use a realistic example", prompt: "Walk me through a realistic example for an agent that responds to compromised employee accounts." },
          { displayText: "Explain the workflow", prompt: "Explain how this conversational policy workflow works before we begin." },
        ]}
      >
        <AgentInterface.Sidebar>
          <AgentInterface.SidebarHeader
            logo={<div className="aegis-mark small" aria-hidden="true">A</div>}
            agentName={<div className="aegis-brand"><strong>Policy workspace</strong><span>Live completion status</span></div>}
          />
          <AgentInterface.SidebarContent>
            <PolicyProgressPanel />
          </AgentInterface.SidebarContent>
        </AgentInterface.Sidebar>
        <AgentInterface.Workspace>
          <PolicySummaryPanel />
        </AgentInterface.Workspace>
        <AgentInterface.Welcome
          glowAnimation
          image={<div className="welcome-mark" aria-hidden="true">A</div>}
          title="Turn policy complexity into a conversation"
          description="Describe your AI agent. I’ll structure its identity, access, data controls, and guardrails while you stay in control."
        />
      </AgentInterface>
    </main>
  );
}
