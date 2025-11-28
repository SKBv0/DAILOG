import { ThemeConfig } from "../theme";

export interface RightPanelTheme {
  background: string;
  border: string;
  header: {
    background: string;
    border: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
  };
  tabs: {
    active: {
      text: string;
      border: string;
    };
    default: {
      text: string;
      hover: string;
    };
  };
  content: {
    background: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
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
    danger: {
      background: string;
      text: string;
      hover: string;
    };
  };
  nodeType: {
    npcDialog: string;
    playerResponse: string;
    enemyDialog: string;
    customNode: string;
    narratorNode: string;
    choiceNode: string;
    branchingNode: string;
    sceneNode: string;
    characterDialogNode: string;
    sceneDescriptionNode: string;
    defaultNode: string;
  };
  section: {
    background: string;
    border: string;
    header: {
      text: string;
      border: string;
    };
  };
  stats: {
    background: string;
    border: string;
    text: {
      label: string;
      value: string;
    };
  };
  selectionPanel: {
    card: {
      background: string;
      border: string;
      backdropFilter: string;
      header: {
        text: string;
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
  };
}

export const getRightPanelTheme = (theme: ThemeConfig): RightPanelTheme => {
  return {
    background: "#0A0A0C",
    border: theme.colors.border,
    header: {
      background: "transparent",
      border: "rgba(255, 255, 255, 0.05)",
      text: {
        primary: theme.colors.text.primary,
        secondary: "rgba(255, 255, 255, 0.6)",
        muted: "rgba(255, 255, 255, 0.4)",
      },
    },
    tabs: {
      active: {
        text: "#3B82F6",
        border: "#3B82F6",
      },
      default: {
        text: "rgba(255, 255, 255, 0.6)",
        hover: theme.colors.text.primary,
      },
    },
    content: {
      background: "transparent",
      text: {
        primary: theme.colors.text.primary,
        secondary: "rgba(255, 255, 255, 0.8)",
        muted: "rgba(255, 255, 255, 0.6)",
      },
    },
    button: {
      default: {
        background: "transparent",
        text: "rgba(255, 255, 255, 0.6)",
        border: "transparent",
      },
      hover: {
        background: "rgba(255, 255, 255, 0.05)",
        text: theme.colors.text.primary,
        border: "rgba(255, 255, 255, 0.1)",
      },
      active: {
        background: "rgba(255, 255, 255, 0.1)",
        text: theme.colors.text.primary,
        border: "rgba(255, 255, 255, 0.15)",
      },
      danger: {
        background: "transparent",
        text: "rgba(255, 255, 255, 0.4)",
        hover: "#EF4444",
      },
    },
    nodeType: {
      npcDialog: "#3B82F6",
      playerResponse: "#10B981",
      enemyDialog: "#EF4444",
      customNode: "#60A5FA",
      narratorNode: "#8B5CF6",
      choiceNode: "#F59E0B",
      branchingNode: "#EC4899",
      sceneNode: "#6366F1",
      characterDialogNode: "#0EA5E9",
      sceneDescriptionNode: "#14B8A6",
      defaultNode: "#6B7280",
    },
    section: {
      background: "rgba(255, 255, 255, 0.02)",
      border: "rgba(255, 255, 255, 0.05)",
      header: {
        text: theme.colors.text.secondary,
        border: "rgba(255, 255, 255, 0.05)",
      },
    },
    stats: {
      background: "rgba(255, 255, 255, 0.02)",
      border: "rgba(255, 255, 255, 0.05)",
      text: {
        label: "rgba(255, 255, 255, 0.6)",
        value: theme.colors.text.primary,
      },
    },
    selectionPanel: {
      card: {
        background: "rgba(17, 17, 17, 0.5)",
        border: "rgba(31, 31, 31, 0.5)",
        backdropFilter: "blur(8px)",
        header: {
          text: "#E5E7EB",
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
    },
  };
};
