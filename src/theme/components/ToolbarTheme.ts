import { ThemeConfig } from "../theme";

export interface ToolbarTheme {
  background: string;
  border: string;
  button: {
    default: {
      background: string;
      text: string;
      border: string;
    };
    hover: {
      background: string;
      text: string;
      border: string;
    };
    active: {
      background: string;
      text: string;
      border: string;
    };
    disabled: {
      background: string;
      text: string;
      border: string;
    };
  };
  divider: string;
  tooltip: {
    background: string;
    text: string;
  };
  logo: {
    background: string;
    borderColor: string;
    glow: {
      primary: string;
      secondary: string;
    };
    text: {
      colors: string[];
      shadow: string;
    };
    borderAnimation: {
      color: string;
      duration: string;
    };
  };
  modal: {
    overlay: string;
    background: string;
    border: string;
    header: {
      text: string;
      border?: string;
    };
    content: {
      text: string;
    };
    input?: {
      background: string;
      border: string;
      text: string;
      placeholder: string;
    };
    button?: {
      primary: {
        background: string;
        hover: string;
        text: string;
      };
      secondary: {
        background: string;
        hover: string;
        text: string;
      };
    };
  };
}

export const getToolbarTheme = (theme: ThemeConfig): ToolbarTheme => {
  return {
    background: theme.colors.toolbar.background,
    border: theme.colors.toolbar.border,
    button: {
      default: {
        background: theme.colors.toolbar.button.default.background,
        text: theme.colors.toolbar.button.default.text,
        border: theme.colors.toolbar.button.default.border,
      },
      hover: {
        background: theme.colors.toolbar.button.hover.background,
        text: theme.colors.toolbar.button.hover.text,
        border: theme.colors.toolbar.button.hover.border,
      },
      active: {
        background: theme.colors.toolbar.button.active.background,
        text: theme.colors.toolbar.button.active.text,
        border: theme.colors.toolbar.button.active.border,
      },
      disabled: {
        background: theme.colors.toolbar.button.disabled.background,
        text: theme.colors.toolbar.button.disabled.text,
        border: theme.colors.toolbar.button.disabled.border,
      },
    },
    divider: theme.colors.toolbar.divider,
    tooltip: {
      background: theme.colors.toolbar.tooltip.background,
      text: theme.colors.toolbar.tooltip.text,
    },
    logo: {
      background: theme.colors.toolbar.logo.background,
      borderColor: theme.colors.toolbar.logo.borderColor,
      glow: {
        primary: theme.colors.toolbar.logo.glow.primary,
        secondary: theme.colors.toolbar.logo.glow.secondary,
      },
      text: {
        colors: theme.colors.toolbar.logo.text.colors,
        shadow: theme.colors.toolbar.logo.text.shadow,
      },
      borderAnimation: {
        color: theme.colors.toolbar.logo.borderAnimation.color,
        duration: theme.colors.toolbar.logo.borderAnimation.duration,
      },
    },
    modal: {
      overlay: theme.ui?.modal?.overlay || "rgba(0, 0, 0, 0.6)",
      background: theme.ui?.modal?.background || "#0D0D0F",
      border: theme.ui?.modal?.border || "rgba(31, 41, 55, 0.5)",
      header: {
        text: theme.ui?.modal?.header?.text || "#E5E7EB",
        border: theme.ui?.modal?.header?.border,
      },
      content: {
        text: theme.ui?.modal?.content?.text || "#D1D5DB",
      },
      input: {
        background: theme.ui?.form?.input?.background || "#111113",
        border: theme.ui?.form?.input?.border || "#1A1A1C",
        text: theme.ui?.form?.input?.text || "#E5E7EB",
        placeholder: theme.ui?.form?.input?.placeholder || "#6B7280",
      },
      button: {
        primary: {
          background: "#2563EB",
          hover: "#1D4ED8",
          text: "#FFFFFF",
        },
        secondary: {
          background: "rgba(31, 41, 55, 0.5)",
          hover: "rgba(31, 41, 55, 0.7)",
          text: "#E5E7EB",
        },
      },
    },
  };
};
