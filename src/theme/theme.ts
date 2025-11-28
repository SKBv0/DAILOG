import { DialogNodeType } from "../types/dialog";

export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  accent: {
    npc: string;
    player: string;
  };
  hover: {
    background: string;
    border: string;
  };
  sidebar: {
    background: string;
    border: string;
    item: {
      background: string;
      hover: string;
      active: string;
      text: {
        default: string;
        active: string;
      };
      icon: {
        default: string;
        active: string;
      };
    };
    section: {
      header: {
        text: string;
        border: string;
      };
      content: {
        background: string;
        border: string;
      };
    };
  };
  toolbar: {
    background: string;
    border: string;
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
  };
  panel: {
    background: string;
    border: string;
    header: {
      background: string;
      border: string;
    };
    section: {
      background: string;
      border: string;
    };
  };
}

interface NodeStateStyle {
  backgroundColor?: string;
  borderColor?: string;
  boxShadow?: string;
  indicator?: {
    size: string;
    background: string;
    boxShadow: string;
  };
  connectionPoint?: {
    size: string;
    border: string;
    background: string;
    boxShadow: string;
  };
}

interface NodeTypeStyle {
  default: NodeStateStyle;
  selected: NodeStateStyle;
  hover: {
    indicator?: {
      background: string;
      boxShadow: string;
    };
    connectionPoint?: {
      background: string;
      boxShadow: string;
    };
  };
}

export interface NodeStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
  boxShadow: string;
  backdropFilter: string;
  header: {
    background: string;
    borderBottom: string;
  };
  indicator: {
    size: string;
    background: string;
    boxShadow: string;
  };
  tag: {
    background: string;
    border: string;
    textColor: string;
  };
  connectionPoint: {
    size: string;
    border: string;
    background: string;
    boxShadow: string;
    hover: {
      background: string;
      boxShadow: string;
    };
  };
}

export interface ThemeConfig {
  colors: ThemeColors;
  nodes: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    borderRadius: string;
    padding: {
      header: string;
      content: string;
    };
    fontSize: {
      header: string;
      content: string;
    };
    styles: {
      npc: NodeTypeStyle;
      player: NodeTypeStyle;
      common: {
        backdropFilter: string;
        header: {
          background: string;
          borderBottom: string;
        };
        tag: {
          background: string;
          border: string;
          textColor: string;
        };
      };
    };
  };
  connections: {
    width: number;
    height: number;
    opacity: {
      default: number;
      hover: number;
    };
    transition: string;
    styles: {
      npc: {
        default: string;
        hover: string;
        highlighted: string;
        shadow: {
          default: string;
          highlighted: string;
        };
      };
      player: {
        default: string;
        hover: string;
        highlighted: string;
        shadow: {
          default: string;
          highlighted: string;
        };
      };
      default: {
        default: string;
        hover: string;
        highlighted: string;
        shadow: {
          default: string;
          highlighted: string;
        };
      };
    };
    editor: {
      background: string;
      border: string;
      input: {
        background: string;
        border: string;
        text: string;
        placeholder: string;
      };
      button: {
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
        danger: {
          background: string;
          hover: string;
          text: string;
        };
      };
    };
  };
  selectionPanel: {
    tabs: {
      active: {
        text: string;
        indicator: string;
      };
      default: {
        text: string;
      };
    };
    card: {
      background: string;
      border: string;
      backdropFilter: string;
      header: {
        text: string;
        icon: {
          default: string;
        };
      };
      content: {
        text: string;
      };
    };
    aiFeatures: {
      header: {
        text: string;
        icon: string;
        border: string;
      };
      button: {
        background: string;
        border: string;
        text: {
          primary: string;
          secondary: string;
        };
        icon: {
          background: string;
          text: string;
        };
      };
    };
    navigation: {
      node: {
        background: string;
        text: string;
        indicator: {
          npc: string;
          player: string;
        };
      };
    };
    modal: {
      overlay: string;
      background: string;
      border: string;
      backdropFilter: string;
    };
    analysis: {
      section: {
        background: string;
        border: string;
        hover: string;
      };
      header: {
        text: string;
        icon: {
          overview: string;
          nodes: string;
          structure: string;
          paths: string;
        };
        chevron: string;
      };
      content: {
        background: string;
        border: string;
        item: {
          background: string;
          label: string;
          values: {
            overview: string;
            nodes: string;
            structure: string;
            paths: string;
          };
        };
      };
    };
    pathList: {
      stats: {
        background: string;
        border: string;
        text: {
          primary: string;
          secondary: string;
        };
        icon: {
          paths: string;
          player: string;
          npc: string;
        };
        button: {
          background: string;
          hover: string;
          text: string;
          hoverText: string;
        };
      };
      group: {
        background: string;
        border: string;
        header: {
          background: string;
          border: string;
          text: {
            primary: string;
            secondary: string;
          };
          counter: {
            npc: {
              background: string;
              text: string;
            };
            player: {
              background: string;
              text: string;
            };
          };
          button: {
            default: {
              background: string;
              text: string;
            };
            hover: {
              background: string;
              text: string;
            };
            active: {
              background: string;
              text: string;
            };
          };
        };
        content: {
          background: string;
        };
      };
      path: {
        background: string;
        border: string;
        hoverBorder: string;
        header: {
          text: {
            primary: string;
            secondary: string;
          };
          counter: {
            background: string;
            text: string;
          };
          indicator: {
            npc: {
              background: string;
              border: string;
              text: string;
            };
            player: {
              background: string;
              border: string;
              text: string;
            };
          };
          button: {
            collapsed: {
              background: string;
              text: string;
            };
            expanded: {
              background: string;
              text: string;
            };
          };
        };
      };
      timeline: {
        line: string;
        dot: {
          npc: string;
          player: string;
        };
        message: {
          npc: {
            background: string;
            border: string;
            text: string;
          };
          player: {
            background: string;
            border: string;
            text: string;
          };
        };
      };
    };
    validation: {
      background: string;
      header: {
        text: string;
      };
      stats: {
        background: string;
        border: string;
        text: {
          label: string;
          value: string;
          warning: string;
        };
      };
      issues: {
        deadEnd: {
          background: string;
          text: string;
          border: string;
          icon: string;
        };
        inconsistency: {
          background: string;
          text: string;
          border: string;
          icon: string;
        };
        contextGap: {
          background: string;
          text: string;
          border: string;
          icon: string;
        };
        toneShift: {
          background: string;
          text: string;
          border: string;
          icon: string;
        };
      };
      fixButton: {
        background: string;
        hover: string;
        text: string;
      };
    };
  };
  sidebar: {
    background: string;
    border: string;
    item: {
      background: string;
      hover: string;
      active: string;
      text: {
        default: string;
        active: string;
      };
      icon: {
        default: string;
        active: string;
      };
    };
    section: {
      header: {
        text: string;
        border: string;
      };
      content: {
        background: string;
        border: string;
      };
    };
  };
  ui: {
    toast: {
      success: {
        background: string;
        text: string;
        icon: string;
      };
      error: {
        background: string;
        text: string;
        icon: string;
      };
      warning: {
        background: string;
        text: string;
        icon: string;
      };
      info: {
        background: string;
        text: string;
        icon: string;
      };
    };
    modal: {
      overlay: string;
      background: string;
      border: string;
      backdropFilter: string;
      header: {
        text: string;
        border: string;
      };
      content: {
        text: string;
      };
    };
    form: {
      input: {
        background: string;
        border: string;
        text: string;
        placeholder: string;
        focus: {
          border: string;
          ring: string;
        };
      };
      select: {
        background: string;
        border: string;
        text: string;
        icon: string;
        option: {
          background: string;
          hover: string;
          selected: string;
          text: string;
        };
      };
      checkbox: {
        background: string;
        border: string;
        checked: {
          background: string;
          border: string;
          icon: string;
        };
      };
    };
    tooltip: {
      background: string;
      text: string;
      border: string;
      arrow: string;
    };
  };
  settings: {
    modal: {
      background: string;
      border: string;
      header: {
        text: string;
        border: string;
      };
      section: {
        title: string;
        description: string;
      };
      footer: {
        background: string;
        border: string;
        button: {
          cancel: {
            background: string;
            hover: string;
            text: string;
          };
          save: {
            enabled: {
              background: string;
              hover: string;
              text: string;
            };
            disabled: {
              background: string;
              text: string;
            };
          };
        };
      };
    };
  };
  connection: {
    default: {
      color: string;
      thickness: number;
      opacity: {
        default: number;
        hover: number;
        highlighted: number;
      };
    };
    types: {
      npc: {
        color: string;
        opacity: {
          default: number;
          hover: number;
          highlighted: number;
        };
      };
      player: {
        color: string;
        opacity: {
          default: number;
          hover: number;
          highlighted: number;
        };
      };
    };
    shadow: {
      color: string;
      opacity: {
        default: number;
        highlighted: number;
      };
      blur: number;
    };
    endpoints: {
      radius: number;
      fill: string;
      transition: string;
    };
    deleteButton: {
      background: string;
      border: string;
      icon: string;
      hover: {
        background: string;
        border: string;
        icon: string;
      };
    };
    animation: {
      duration: string;
      timing: string;
    };
  };
  validationPanel: {
    background: string;
    header: {
      text: string;
      border: string;
    };
    stats: {
      background: string;
      border: string;
      text: {
        label: string;
        value: string;
      };
      issues: {
        deadEnd: string;
        inconsistency: string;
        contextGap: string;
        toneShift: string;
      };
    };
    issueTypes: {
      deadEnd: {
        background: string;
        text: string;
        border: string;
        icon: string;
      };
      inconsistency: {
        background: string;
        text: string;
        border: string;
        icon: string;
      };
      contextGap: {
        background: string;
        text: string;
        border: string;
        icon: string;
      };
      toneShift: {
        background: string;
        text: string;
        border: string;
        icon: string;
      };
    };
    issue: {
      background: string;
      border: string;
      hover: {
        background: string;
        border: string;
      };
      header: {
        text: string;
        subtext: string;
      };
      content: {
        text: string;
        suggestion: string;
      };
      button: {
        background: string;
        text: string;
        hover: {
          background: string;
          text: string;
        };
      };
    };
  };
  toolbar: {
    background: string;
    border: string;
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
  };
}

export const defaultTheme: ThemeConfig = {
  colors: {
    background: "#030711",
    surface: "#0F1629",
    border: "#1E293B",
    text: {
      primary: "#F8FAFC",
      secondary: "#CBD5E1",
      muted: "#64748B",
    },
    accent: {
      npc: "#8B5CF6",
      player: "#10B981",
    },
    hover: {
      background: "#1E293B",
      border: "#334155",
    },
    sidebar: {
      background: "#0D0D0F",
      border: "rgba(31, 41, 55, 0.5)",
      item: {
        background: "transparent",
        hover: "rgba(31, 41, 55, 0.5)",
        active: "rgba(55, 65, 81, 0.5)",
        text: {
          default: "#9CA3AF",
          active: "#E5E7EB",
        },
        icon: {
          default: "#6B7280",
          active: "#8B5CF6",
        },
      },
      section: {
        header: {
          text: "#9CA3AF",
          border: "rgba(31, 41, 55, 0.5)",
        },
        content: {
          background: "rgba(17, 24, 39, 0.3)",
          border: "rgba(31, 41, 55, 0.3)",
        },
      },
    },
    toolbar: {
      background: "#0D0D0F",
      border: "rgba(30, 30, 35, 0.5)",
      logo: {
        background: "#0F0F12",
        borderColor: "#2A2A36",
        glow: {
          primary: "rgba(124, 58, 237, 0.2)",
          secondary: "rgba(99, 102, 241, 0.1)",
        },
        text: {
          colors: [
            "rgba(120, 60, 220, 1)",
            "rgba(140, 60, 220, 1)",
            "rgba(160, 60, 220, 1)",
            "rgba(180, 60, 220, 1)",
            "rgba(200, 60, 220, 1)",
            "rgba(220, 60, 220, 1)",
          ],
          shadow: "0 0 15px rgba(124, 58, 237, 0.8), 0 0 5px rgba(124, 58, 237, 0.6)",
        },
        borderAnimation: {
          color: "rgba(124, 58, 237, 0.8)",
          duration: "3s",
        },
      },
      button: {
        default: {
          background: "rgba(30, 30, 35, 0.5)",
          text: "rgba(180, 180, 190, 0.8)",
          border: "rgba(50, 50, 60, 0.5)",
        },
        hover: {
          background: "rgba(40, 40, 50, 0.7)",
          text: "rgba(220, 220, 230, 1)",
          border: "rgba(80, 80, 100, 0.7)",
        },
        active: {
          background: "rgba(60, 60, 80, 0.8)",
          text: "rgba(240, 240, 250, 1)",
          border: "rgba(100, 100, 140, 0.8)",
        },
        disabled: {
          background: "rgba(30, 30, 35, 0.3)",
          text: "rgba(120, 120, 130, 0.5)",
          border: "rgba(50, 50, 60, 0.3)",
        },
      },
      divider: "rgba(55, 65, 81, 0.5)",
      tooltip: {
        background: "rgba(20, 20, 25, 0.95)",
        text: "rgba(220, 220, 230, 1)",
      },
    },
    panel: {
      background: "#0F1629",
      border: "#1E293B",
      header: {
        background: "#1E293B",
        border: "#334155",
      },
      section: {
        background: "#1E293B",
        border: "#334155",
      },
    },
  },
  nodes: {
    minWidth: 280,
    maxWidth: 520,
    minHeight: 100,
    maxHeight: 400,
    borderRadius: "12px",
    padding: {
      header: "16px",
      content: "16px",
    },
    fontSize: {
      header: "12px",
      content: "14px",
    },
    styles: {
      npc: {
        default: {
          backgroundColor: "rgba(139, 92, 246, 0.05)",
          borderColor: "rgba(139, 92, 246, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.05)",
          indicator: {
            size: "8px",
            background: "rgb(139, 92, 246)",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.3)",
          },
          connectionPoint: {
            size: "12px",
            border: "rgb(139, 92, 246)",
            background: "rgba(139, 92, 246, 0.2)",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.2)",
          },
        },
        selected: {
          borderColor: "rgba(139, 92, 246, 0.5)",
          boxShadow: "0 8px 24px rgba(139, 92, 246, 0.15), inset 0 1px 2px rgba(139, 92, 246, 0.1)",
        },
        hover: {
          indicator: {
            background: "rgb(167, 139, 250)",
            boxShadow: "0 0 16px rgba(139, 92, 246, 0.4)",
          },
          connectionPoint: {
            background: "rgb(139, 92, 246)",
            boxShadow: "0 0 16px rgba(139, 92, 246, 0.3)",
          },
        },
      } as NodeTypeStyle,
      player: {
        default: {
          backgroundColor: "rgba(16, 185, 129, 0.05)",
          borderColor: "rgba(16, 185, 129, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.05)",
          indicator: {
            size: "8px",
            background: "rgb(16, 185, 129)",
            boxShadow: "0 0 12px rgba(16, 185, 129, 0.3)",
          },
          connectionPoint: {
            size: "12px",
            border: "rgb(16, 185, 129)",
            background: "rgba(16, 185, 129, 0.2)",
            boxShadow: "0 0 12px rgba(16, 185, 129, 0.2)",
          },
        },
        selected: {
          borderColor: "rgba(16, 185, 129, 0.5)",
          boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15), inset 0 1px 2px rgba(16, 185, 129, 0.1)",
        },
        hover: {
          indicator: {
            background: "rgb(52, 211, 153)",
            boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)",
          },
          connectionPoint: {
            background: "rgb(16, 185, 129)",
            boxShadow: "0 0 16px rgba(16, 185, 129, 0.3)",
          },
        },
      } as NodeTypeStyle,
      common: {
        backdropFilter: "blur(8px)",
        header: {
          background: "transparent",
          borderBottom: "rgba(255, 255, 255, 0.1)",
        },
        tag: {
          background: "rgba(17, 24, 39, 0.3)",
          border: "rgba(75, 85, 99, 0.2)",
          textColor: "rgb(156, 163, 175)",
        },
      },
    },
  },
  connections: {
    width: 2,
    height: 40,
    opacity: {
      default: 0.4,
      hover: 0.8,
    },
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    styles: {
      npc: {
        default: "rgba(138, 162, 255, 0.4)",
        hover: "rgba(138, 162, 255, 0.6)",
        highlighted: "rgba(138, 162, 255, 0.9)",
        shadow: {
          default: "rgba(138, 162, 255, 0.1)",
          highlighted: "rgba(138, 162, 255, 0.3)",
        },
      },
      player: {
        default: "rgba(139, 211, 162, 0.4)",
        hover: "rgba(139, 211, 162, 0.6)",
        highlighted: "rgba(139, 211, 162, 0.9)",
        shadow: {
          default: "rgba(139, 211, 162, 0.1)",
          highlighted: "rgba(139, 211, 162, 0.3)",
        },
      },
      default: {
        default: "rgba(200, 200, 200, 0.4)",
        hover: "rgba(200, 200, 200, 0.6)",
        highlighted: "rgba(200, 200, 200, 0.9)",
        shadow: {
          default: "rgba(255, 255, 255, 0.1)",
          highlighted: "rgba(255, 255, 255, 0.3)",
        },
      },
    },
    editor: {
      background: "#0D0D0F",
      border: "rgba(31, 41, 55, 0.5)",
      input: {
        background: "#111113",
        border: "#1A1A1C",
        text: "#E5E7EB",
        placeholder: "#6B7280",
      },
      button: {
        primary: {
          background: "#2563EB",
          hover: "#1D4ED8",
          text: "#FFFFFF",
        },
        secondary: {
          background: "#111113",
          hover: "#1A1A1C",
          text: "#E5E7EB",
        },
        danger: {
          background: "rgba(239, 68, 68, 0.2)",
          hover: "rgba(239, 68, 68, 0.3)",
          text: "#EF4444",
        },
      },
    },
  },
  selectionPanel: {
    tabs: {
      active: {
        text: "#8B5CF6",
        indicator: "#8B5CF6",
      },
      default: {
        text: "#6B7280",
      },
    },
    card: {
      background: "rgba(17, 17, 17, 0.5)",
      border: "rgba(31, 31, 31, 0.5)",
      backdropFilter: "blur(8px)",
      header: {
        text: "#E5E7EB",
        icon: {
          default: "#9CA3AF",
        },
      },
      content: {
        text: "#D1D5DB",
      },
    },
    aiFeatures: {
      header: {
        text: "#E5E7EB",
        icon: "#8B5CF6",
        border: "rgba(31, 31, 31, 0.5)",
      },
      button: {
        background: "rgba(31, 31, 31, 0.3)",
        border: "rgba(55, 55, 55, 0.3)",
        text: {
          primary: "#E5E7EB",
          secondary: "#9CA3AF",
        },
        icon: {
          background: "rgba(139, 92, 246, 0.1)",
          text: "#8B5CF6",
        },
      },
    },
    navigation: {
      node: {
        background: "rgba(31, 31, 31, 0.3)",
        text: "#9CA3AF",
        indicator: {
          npc: "#8B5CF6",
          player: "#10B981",
        },
      },
    },
    modal: {
      overlay: "rgba(0, 0, 0, 0.6)",
      background: "#0D0D0F",
      border: "rgba(31, 31, 31, 0.5)",
      backdropFilter: "blur(8px)",
    },
    analysis: {
      section: {
        background: "transparent",
        border: "rgba(31, 31, 31, 0.5)",
        hover: "rgba(31, 31, 31, 0.3)",
      },
      header: {
        text: "#E5E7EB",
        icon: {
          overview: "#3B82F6",
          nodes: "#8B5CF6",
          structure: "#10B981",
          paths: "#F59E0B",
        },
        chevron: "#6B7280",
      },
      content: {
        background: "rgba(17, 17, 17, 0.3)",
        border: "rgba(31, 31, 31, 0.5)",
        item: {
          background: "rgba(31, 31, 31, 0.3)",
          label: "#6B7280",
          values: {
            overview: "#3B82F6",
            nodes: "#8B5CF6",
            structure: "#10B981",
            paths: "#F59E0B",
          },
        },
      },
    },
    pathList: {
      stats: {
        background: "rgba(17, 17, 17, 0.5)",
        border: "rgba(31, 31, 31, 0.5)",
        text: {
          primary: "#E5E7EB",
          secondary: "#6B7280",
        },
        icon: {
          paths: "#8B5CF6",
          player: "#10B981",
          npc: "#8B5CF6",
        },
        button: {
          background: "rgba(31, 31, 31, 0.4)",
          hover: "rgba(31, 31, 31, 0.8)",
          text: "#6B7280",
          hoverText: "#E5E7EB",
        },
      },
      group: {
        background: "rgba(17, 17, 17, 0.8)",
        border: "rgba(31, 31, 31, 0.6)",
        header: {
          background: "rgba(17, 17, 17, 0.3)",
          border: "rgba(31, 31, 31, 0.4)",
          text: {
            primary: "#E5E7EB",
            secondary: "#6B7280",
          },
          counter: {
            npc: {
              background: "rgba(139, 92, 246, 0.4)",
              text: "#DDD6FE",
            },
            player: {
              background: "rgba(16, 185, 129, 0.4)",
              text: "#A7F3D0",
            },
          },
          button: {
            default: {
              background: "rgba(31, 31, 31, 0.6)",
              text: "#6B7280",
            },
            hover: {
              background: "rgba(139, 92, 246, 0.2)",
              text: "#A78BFA",
            },
            active: {
              background: "rgba(139, 92, 246, 0.4)",
              text: "#DDD6FE",
            },
          },
        },
        content: {
          background: "rgba(17, 17, 17, 0.3)",
        },
      },
      path: {
        background: "rgba(17, 17, 17, 0.6)",
        border: "rgba(31, 31, 31, 0.4)",
        hoverBorder: "rgba(55, 65, 81, 0.6)",
        header: {
          text: {
            primary: "#E5E7EB",
            secondary: "#6B7280",
          },
          counter: {
            background: "rgba(31, 31, 31, 0.8)",
            text: "#9CA3AF",
          },
          indicator: {
            npc: {
              background: "rgba(139, 92, 246, 0.3)",
              border: "rgba(139, 92, 246, 0.5)",
              text: "#DDD6FE",
            },
            player: {
              background: "rgba(16, 185, 129, 0.3)",
              border: "rgba(16, 185, 129, 0.5)",
              text: "#A7F3D0",
            },
          },
          button: {
            collapsed: {
              background: "rgba(31, 31, 31, 0.6)",
              text: "#6B7280",
            },
            expanded: {
              background: "rgba(139, 92, 246, 0.2)",
              text: "#A78BFA",
            },
          },
        },
      },
      timeline: {
        line: "rgba(31, 31, 31, 0.6)",
        dot: {
          npc: "#8B5CF6",
          player: "#10B981",
        },
        message: {
          npc: {
            background: "rgba(139, 92, 246, 0.1)",
            border: "rgba(139, 92, 246, 0.2)",
            text: "#E5E7EB",
          },
          player: {
            background: "rgba(16, 185, 129, 0.1)",
            border: "rgba(16, 185, 129, 0.2)",
            text: "#E5E7EB",
          },
        },
      },
    },
    validation: {
      background: "#0D0D0F",
      header: {
        text: "#E5E7EB",
      },
      stats: {
        background: "rgba(17, 24, 39, 0.5)",
        border: "rgba(31, 41, 55, 0.3)",
        text: {
          label: "#9CA3AF",
          value: "#E5E7EB",
          warning: "#FBBF24",
        },
      },
      issues: {
        deadEnd: {
          background: "rgba(234, 179, 8, 0.2)",
          text: "#FBBF24",
          border: "rgba(234, 179, 8, 0.3)",
          icon: "#FBBF24",
        },
        inconsistency: {
          background: "rgba(59, 130, 246, 0.2)",
          text: "#60A5FA",
          border: "rgba(59, 130, 246, 0.3)",
          icon: "#60A5FA",
        },
        contextGap: {
          background: "rgba(139, 92, 246, 0.2)",
          text: "#A78BFA",
          border: "rgba(139, 92, 246, 0.3)",
          icon: "#A78BFA",
        },
        toneShift: {
          background: "rgba(249, 115, 22, 0.2)",
          text: "#FB923C",
          border: "rgba(249, 115, 22, 0.3)",
          icon: "#FB923C",
        },
      },
      fixButton: {
        background: "#059669",
        hover: "#047857",
        text: "#FFFFFF",
      },
    },
  },
  sidebar: {
    background: "#0D0D0F",
    border: "rgba(31, 41, 55, 0.5)",
    item: {
      background: "transparent",
      hover: "rgba(31, 41, 55, 0.5)",
      active: "rgba(55, 65, 81, 0.5)",
      text: {
        default: "#9CA3AF",
        active: "#E5E7EB",
      },
      icon: {
        default: "#6B7280",
        active: "#8B5CF6",
      },
    },
    section: {
      header: {
        text: "#9CA3AF",
        border: "rgba(31, 41, 55, 0.5)",
      },
      content: {
        background: "rgba(17, 24, 39, 0.3)",
        border: "rgba(31, 41, 55, 0.3)",
      },
    },
  },
  ui: {
    toast: {
      success: {
        background: "rgba(16, 185, 129, 0.2)",
        text: "#34D399",
        icon: "#10B981",
      },
      error: {
        background: "rgba(239, 68, 68, 0.2)",
        text: "#F87171",
        icon: "#EF4444",
      },
      warning: {
        background: "rgba(245, 158, 11, 0.2)",
        text: "#FBBF24",
        icon: "#F59E0B",
      },
      info: {
        background: "rgba(59, 130, 246, 0.2)",
        text: "#60A5FA",
        icon: "#3B82F6",
      },
    },
    modal: {
      overlay: "rgba(0, 0, 0, 0.6)",
      background: "#0D0D0F",
      border: "rgba(31, 41, 55, 0.5)",
      backdropFilter: "blur(8px)",
      header: {
        text: "#E5E7EB",
        border: "rgba(31, 41, 55, 0.5)",
      },
      content: {
        text: "#D1D5DB",
      },
    },
    form: {
      input: {
        background: "#111113",
        border: "#1A1A1C",
        text: "#E5E7EB",
        placeholder: "#6B7280",
        focus: {
          border: "#3B82F6",
          ring: "rgba(59, 130, 246, 0.2)",
        },
      },
      select: {
        background: "#111113",
        border: "#1A1A1C",
        text: "#E5E7EB",
        icon: "#6B7280",
        option: {
          background: "#1A1A1C",
          hover: "#374151",
          selected: "#2563EB",
          text: "#E5E7EB",
        },
      },
      checkbox: {
        background: "#111113",
        border: "#1A1A1C",
        checked: {
          background: "#2563EB",
          border: "#2563EB",
          icon: "#FFFFFF",
        },
      },
    },
    tooltip: {
      background: "rgba(17, 24, 39, 0.9)",
      text: "#E5E7EB",
      border: "rgba(55, 65, 81, 0.5)",
      arrow: "rgba(17, 24, 39, 0.9)",
    },
  },
  settings: {
    modal: {
      background: "#0F0F12",
      border: "#2A2A36",
      header: {
        text: "#E5E7EB",
        border: "#1A1A1F",
      },
      section: {
        title: "#D1D5DB",
        description: "#9CA3AF",
      },
      footer: {
        background: "#0F0F12",
        border: "#1A1A1F",
        button: {
          cancel: {
            background: "transparent",
            hover: "#1A1A1F",
            text: "#9CA3AF",
          },
          save: {
            enabled: {
              background: "#2563EB",
              hover: "#1D4ED8",
              text: "#FFFFFF",
            },
            disabled: {
              background: "#1A1A1F",
              text: "#6B7280",
            },
          },
        },
      },
    },
  },
  connection: {
    default: {
      color: "rgb(200, 200, 200)",
      thickness: 2,
      opacity: {
        default: 0.4,
        hover: 0.6,
        highlighted: 0.9,
      },
    },
    types: {
      npc: {
        color: "rgb(138, 162, 255)",
        opacity: {
          default: 0.4,
          hover: 0.6,
          highlighted: 0.9,
        },
      },
      player: {
        color: "rgb(139, 211, 162)",
        opacity: {
          default: 0.4,
          hover: 0.6,
          highlighted: 0.9,
        },
      },
    },
    shadow: {
      color: "rgb(255, 255, 255)",
      opacity: {
        default: 0.1,
        highlighted: 0.3,
      },
      blur: 3,
    },
    endpoints: {
      radius: 3,
      fill: "currentColor",
      transition: "all 0.2s ease",
    },
    deleteButton: {
      background: "rgba(220, 50, 50, 0.8)",
      border: "rgba(255, 80, 80, 0.9)",
      icon: "#FFFFFF",
      hover: {
        background: "rgba(220, 50, 50, 0.9)",
        border: "rgba(255, 80, 80, 1)",
        icon: "#FFFFFF",
      },
    },
    animation: {
      duration: "0.3s",
      timing: "ease",
    },
  },
  validationPanel: {
    background: "#0D0D0F",
    header: {
      text: "#E5E7EB",
      border: "rgba(75, 85, 99, 0.3)",
    },
    stats: {
      background: "rgba(31, 41, 55, 0.5)",
      border: "rgba(75, 85, 99, 0.3)",
      text: {
        label: "#9CA3AF",
        value: "#E5E7EB",
      },
      issues: {
        deadEnd: "#FBBF24",
        inconsistency: "#3B82F6",
        contextGap: "#8B5CF6",
        toneShift: "#F97316",
      },
    },
    issueTypes: {
      deadEnd: {
        background: "rgba(245, 158, 11, 0.2)",
        text: "#FBBF24",
        border: "rgba(245, 158, 11, 0.3)",
        icon: "#FBBF24",
      },
      inconsistency: {
        background: "rgba(59, 130, 246, 0.2)",
        text: "#3B82F6",
        border: "rgba(59, 130, 246, 0.3)",
        icon: "#3B82F6",
      },
      contextGap: {
        background: "rgba(139, 92, 246, 0.2)",
        text: "#8B5CF6",
        border: "rgba(139, 92, 246, 0.3)",
        icon: "#8B5CF6",
      },
      toneShift: {
        background: "rgba(249, 115, 22, 0.2)",
        text: "#F97316",
        border: "rgba(249, 115, 22, 0.3)",
        icon: "#F97316",
      },
    },
    issue: {
      background: "rgba(31, 41, 55, 0.3)",
      border: "rgba(75, 85, 99, 0.2)",
      hover: {
        background: "rgba(31, 41, 55, 0.5)",
        border: "rgba(75, 85, 99, 0.3)",
      },
      header: {
        text: "#E5E7EB",
        subtext: "#9CA3AF",
      },
      content: {
        text: "#D1D5DB",
        suggestion: "#9CA3AF",
      },
      button: {
        background: "rgba(59, 130, 246, 0.2)",
        text: "#60A5FA",
        hover: {
          background: "rgba(59, 130, 246, 0.3)",
          text: "#93C5FD",
        },
      },
    },
  },
  toolbar: {
    background: "#0D0D0F",
    border: "rgba(31, 41, 55, 0.5)",
    logo: {
      background: "#0F0F12",
      borderColor: "#2A2A36",
      glow: {
        primary: "rgba(124, 58, 237, 0.2)",
        secondary: "rgba(99, 102, 241, 0.1)",
      },
      text: {
        colors: [
          "rgba(120, 60, 220, 1)",
          "rgba(140, 60, 220, 1)",
          "rgba(160, 60, 220, 1)",
          "rgba(180, 60, 220, 1)",
          "rgba(200, 60, 220, 1)",
          "rgba(220, 60, 220, 1)",
        ],
        shadow: "0 0 15px rgba(124, 58, 237, 0.8)",
      },
      borderAnimation: {
        color: "rgba(124, 58, 237, 0.8)",
        duration: "3s",
      },
    },
    button: {
      default: {
        background: "rgba(30, 30, 35, 0.5)",
        text: "rgba(180, 180, 190, 0.8)",
        border: "rgba(50, 50, 60, 0.5)",
      },
      hover: {
        background: "rgba(40, 40, 50, 0.7)",
        text: "rgba(220, 220, 230, 1)",
        border: "rgba(80, 80, 100, 0.7)",
      },
      active: {
        background: "rgba(60, 60, 80, 0.8)",
        text: "rgba(240, 240, 250, 1)",
        border: "rgba(100, 100, 140, 0.8)",
      },
      disabled: {
        background: "rgba(30, 30, 35, 0.3)",
        text: "rgba(120, 120, 130, 0.5)",
        border: "rgba(50, 50, 60, 0.3)",
      },
    },
    divider: "rgba(55, 65, 81, 0.5)",
    tooltip: {
      background: "rgba(20, 20, 25, 0.95)",
      text: "rgba(220, 220, 230, 1)",
    },
  },
};

export const getNodeStyle = (
  type: DialogNodeType,
  theme: ThemeConfig,
  isSelected: boolean = false
): NodeStyle => {
  const nodeType = type === "npcDialog" ? theme.nodes.styles.npc : theme.nodes.styles.player;
  const common = theme.nodes.styles.common;

  return {
    backgroundColor: nodeType.default.backgroundColor!,
    borderColor: isSelected ? nodeType.selected.borderColor! : nodeType.default.borderColor!,
    textColor: theme.colors.text.primary,
    accentColor: type === "npcDialog" ? theme.colors.accent.npc : theme.colors.accent.player,
    boxShadow: isSelected ? nodeType.selected.boxShadow! : nodeType.default.boxShadow!,
    backdropFilter: common.backdropFilter,
    header: {
      background: common.header.background,
      borderBottom: common.header.borderBottom,
    },
    indicator: {
      size: nodeType.default.indicator!.size,
      background: nodeType.default.indicator!.background,
      boxShadow: nodeType.default.indicator!.boxShadow,
    },
    tag: {
      background: common.tag.background,
      border: common.tag.border,
      textColor: common.tag.textColor,
    },
    connectionPoint: {
      size: nodeType.default.connectionPoint!.size,
      border: nodeType.default.connectionPoint!.border,
      background: nodeType.default.connectionPoint!.background,
      boxShadow: nodeType.default.connectionPoint!.boxShadow,
      hover: {
        background: nodeType.hover.connectionPoint!.background,
        boxShadow: nodeType.hover.connectionPoint!.boxShadow,
      },
    },
  };
};

export const getNodeDimensions = (text: string, theme: ThemeConfig) => {
  return {
    width: Math.max(theme.nodes.minWidth, Math.min(text.length * 8, theme.nodes.maxWidth)),
    height: Math.max(
      theme.nodes.minHeight,
      Math.min(80 + Math.ceil(text.length / 35) * 24, theme.nodes.maxHeight)
    ),
  };
};

export const darkTheme: ThemeConfig = {
  colors: {
    background: "#0A0A0B",
    surface: "#1A1A1F",
    border: "#2D2D33",
    text: {
      primary: "#FFFFFF",
      secondary: "#A1A1AA",
      muted: "#71717A",
    },
    accent: {
      npc: "#7C3AED",
      player: "#10B981",
    },
    hover: {
      background: "#2D2D33",
      border: "#3F3F46",
    },
    sidebar: {
      background: "#0D0D0F",
      border: "#1F1F23",
      item: {
        background: "transparent",
        hover: "rgba(31, 41, 55, 0.5)",
        active: "rgba(55, 65, 81, 0.5)",
        text: {
          default: "#9CA3AF",
          active: "#E5E7EB",
        },
        icon: {
          default: "#6B7280",
          active: "#8B5CF6",
        },
      },
      section: {
        header: {
          text: "#9CA3AF",
          border: "rgba(31, 41, 55, 0.5)",
        },
        content: {
          background: "rgba(17, 24, 39, 0.3)",
          border: "rgba(31, 41, 55, 0.3)",
        },
      },
    },
    toolbar: {
      background: "#0D0D0F",
      border: "#1F1F23",
      logo: {
        background: "#0F0F12",
        borderColor: "#2A2A36",
        glow: {
          primary: "rgba(124, 58, 237, 0.2)",
          secondary: "rgba(99, 102, 241, 0.1)",
        },
        text: {
          colors: [
            "rgba(120, 60, 220, 1)",
            "rgba(140, 60, 220, 1)",
            "rgba(160, 60, 220, 1)",
            "rgba(180, 60, 220, 1)",
            "rgba(200, 60, 220, 1)",
            "rgba(220, 60, 220, 1)",
          ],
          shadow: "0 0 15px rgba(124, 58, 237, 0.8)",
        },
        borderAnimation: {
          color: "rgba(124, 58, 237, 0.8)",
          duration: "3s",
        },
      },
      button: {
        default: {
          background: "rgba(30, 30, 35, 0.5)",
          text: "rgba(180, 180, 190, 0.8)",
          border: "rgba(50, 50, 60, 0.5)",
        },
        hover: {
          background: "rgba(40, 40, 50, 0.7)",
          text: "rgba(220, 220, 230, 1)",
          border: "rgba(80, 80, 100, 0.7)",
        },
        active: {
          background: "rgba(60, 60, 80, 0.8)",
          text: "rgba(240, 240, 250, 1)",
          border: "rgba(100, 100, 140, 0.8)",
        },
        disabled: {
          background: "rgba(30, 30, 35, 0.3)",
          text: "rgba(120, 120, 130, 0.5)",
          border: "rgba(50, 50, 60, 0.3)",
        },
      },
      divider: "rgba(55, 65, 81, 0.5)",
      tooltip: {
        background: "rgba(20, 20, 25, 0.95)",
        text: "rgba(220, 220, 230, 1)",
      },
    },
    panel: {
      background: "#0D0D0F",
      border: "#1F1F23",
      header: {
        background: "#1E293B",
        border: "#334155",
      },
      section: {
        background: "#1E293B",
        border: "#334155",
      },
    },
  },
  nodes: {
    minWidth: 280,
    maxWidth: 520,
    minHeight: 100,
    maxHeight: 400,
    borderRadius: "12px",
    padding: {
      header: "16px",
      content: "16px",
    },
    fontSize: {
      header: "12px",
      content: "14px",
    },
    styles: {
      npc: {
        default: {
          backgroundColor: "rgba(139, 92, 246, 0.05)",
          borderColor: "rgba(139, 92, 246, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          indicator: {
            size: "8px",
            background: "rgb(139, 92, 246)",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.3)",
          },
          connectionPoint: {
            size: "12px",
            border: "rgb(139, 92, 246)",
            background: "rgba(139, 92, 246, 0.2)",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.2)",
          },
        },
        selected: {
          borderColor: "rgba(139, 92, 246, 0.5)",
          boxShadow: "0 8px 24px rgba(139, 92, 246, 0.15)",
        },
        hover: {
          indicator: {
            background: "rgb(167, 139, 250)",
            boxShadow: "0 0 16px rgba(139, 92, 246, 0.4)",
          },
          connectionPoint: {
            background: "rgb(139, 92, 246)",
            boxShadow: "0 0 16px rgba(139, 92, 246, 0.3)",
          },
        },
      },
      player: {
        default: {
          backgroundColor: "rgba(16, 185, 129, 0.05)",
          borderColor: "rgba(16, 185, 129, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          indicator: {
            size: "8px",
            background: "rgb(16, 185, 129)",
            boxShadow: "0 0 12px rgba(16, 185, 129, 0.3)",
          },
          connectionPoint: {
            size: "12px",
            border: "rgb(16, 185, 129)",
            background: "rgba(16, 185, 129, 0.2)",
            boxShadow: "0 0 12px rgba(16, 185, 129, 0.2)",
          },
        },
        selected: {
          borderColor: "rgba(16, 185, 129, 0.5)",
          boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)",
        },
        hover: {
          indicator: {
            background: "rgb(52, 211, 153)",
            boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)",
          },
          connectionPoint: {
            background: "rgb(16, 185, 129)",
            boxShadow: "0 0 16px rgba(16, 185, 129, 0.3)",
          },
        },
      },
      common: {
        backdropFilter: "blur(8px)",
        header: {
          background: "transparent",
          borderBottom: "rgba(255, 255, 255, 0.1)",
        },
        tag: {
          background: "rgba(17, 24, 39, 0.3)",
          border: "rgba(75, 85, 99, 0.2)",
          textColor: "rgb(156, 163, 175)",
        },
      },
    },
  },
} as ThemeConfig;
