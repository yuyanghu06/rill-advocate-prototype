import type Anthropic from "@anthropic-ai/sdk";

// Re-exported from streamMarkers for backwards compatibility.
export { REDIRECT_MARKER_PREFIX, REDIRECT_MARKER_SUFFIX } from "@/lib/streamMarkers";

export const REDIRECT_PRESETS = {
  LINKEDIN_EXPORT: "https://www.linkedin.com/mypreferences/d/download-my-data",
  GITHUB_PROFILE: "https://github.com/",
};

export const redirectUserTool: Anthropic.Tool = {
  name: "redirect_user",
  description:
    "Signal the frontend to redirect or open a URL for the user. Use this when the user needs to visit an external page to complete a step — like downloading their LinkedIn export. Do not use this for internal app navigation.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to redirect the user to",
      },
      label: {
        type: "string",
        description:
          "Short human-readable label for the link shown in the UI, e.g. 'Export LinkedIn Data'",
      },
      reason: {
        type: "string",
        description:
          "One sentence explaining why the user is being redirected, shown as a message in the chat before the link appears",
      },
      open_in_new_tab: {
        type: "boolean",
        description:
          "Whether to open the URL in a new tab instead of navigating away. Defaults to true.",
      },
    },
    required: ["url", "label", "reason"],
  },
};

export type RedirectPayload = {
  url: string;
  label: string;
  reason: string;
  open_in_new_tab: boolean;
};

type RedirectInput = {
  url: string;
  label: string;
  reason: string;
  open_in_new_tab?: boolean;
};

// This tool is purely a signal — no HTTP calls made here.
// The route handler picks up `redirect` and injects it into the stream.
export function handleRedirectUser(input: RedirectInput): {
  success: true;
  message: string;
  redirect: RedirectPayload;
} {
  return {
    success: true,
    message: "Redirect signal sent to frontend.",
    redirect: {
      url: input.url,
      label: input.label,
      reason: input.reason,
      open_in_new_tab: input.open_in_new_tab ?? true,
    },
  };
}
