import { useEffect, useRef } from "react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import ChatGptIcon from "../icons/chatgpt.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import ShareIcon from "../icons/share.svg";
import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";

import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
} from "../constant";

import { useNavigate } from "react-router-dom";
import { useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { get, set } from "idb-keyval";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? 300);
  const lastUpdateTime = useRef(Date.now());

  const handleMouseMove = useRef((e: MouseEvent) => {
    if (Date.now() < lastUpdateTime.current + 50) {
      return;
    }
    lastUpdateTime.current = Date.now();
    const d = e.clientX - startX.current;
    const nextWidth = limit(startDragWidth.current + d);
    config.update((config) => (config.sidebarWidth = nextWidth));
  });

  const handleMouseUp = useRef(() => {
    startDragWidth.current = config.sidebarWidth ?? 300;
    window.removeEventListener("mousemove", handleMouseMove.current);
    window.removeEventListener("mouseup", handleMouseUp.current);
  });

  const onDragMouseDown = (e: MouseEvent) => {
    startX.current = e.clientX;

    window.addEventListener("mousemove", handleMouseMove.current);
    window.addEventListener("mouseup", handleMouseUp.current);
  };
  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? 300);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragMouseDown,
    shouldNarrow,
  };
}

export function SideBar(props: { className?: string }) {
  const chatStore = useChatStore();

  // drag side bar
  const { onDragMouseDown, shouldNarrow } = useDragSideBar();
  const navigate = useNavigate();

  const searchParams = useSearchParams();
  const accessCode = searchParams.get("code");
  const { data, status, takeSimCount } = useSimCount(accessCode);

  function renderSimCount() {
    if (status === "success" && data !== -1) {
      return <p style={{ fontSize: 12 }}>{data} / 3 Simulations Remaining</p>;
    }
    return null;
  }

  return (
    <div
      className={`${styles.sidebar} ${props.className} ${
        shouldNarrow && styles["narrow-sidebar"]
      }`}
    >
      <div className={styles["sidebar-header"]}>
        <div className={styles["sidebar-title"]}>Mentor Inc.</div>
        <div className={styles["sidebar-sub-title"]}>
          Sales Training Assistant
        </div>
        <div className={styles["sidebar-logo"]}>
          <ChatGptIcon />
        </div>
      </div>

      <div
        className={styles["sidebar-body"]}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        {renderSimCount()}
        <ChatList narrow={shouldNarrow} />
      </div>

      <div className={styles["sidebar-tail"]}>
        <div className={styles["sidebar-actions"]}>
          <div className={styles["sidebar-action"] + " " + styles.mobile}>
            <IconButton
              icon={<CloseIcon />}
              onClick={chatStore.deleteSession}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <IconButton
            disabled={!data || data < 1}
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={() => {
              chatStore.newSession();
              takeSimCount();
            }}
            shadow
          />
          <IconButton
            text="Contact Us for Full Access"
            className={styles["sidebar-contact-btn"]}
            onClick={() => {
              window.open("https://www.mentorinc.io/en/corporate");
            }}
          />
        </div>
      </div>

      <div
        className={styles["sidebar-drag"]}
        onMouseDown={(e) => onDragMouseDown(e as any)}
      ></div>
    </div>
  );
}

async function fetchSimCount(code: string | null): Promise<number> {
  if (!code) {
    return -1;
  }
  const val = Number(await get(code));
  if (Number.isNaN(val)) {
    return -1;
  } else {
    return val;
  }
}

async function setSimCount(code: string, remaining: number) {
  await set(code, remaining);
}

function useSimCount(code: string | null) {
  const queryData = useQuery({
    queryKey: [code],
    queryFn: ({ queryKey }) => fetchSimCount(queryKey[0]),
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ code, remaining }: any) => {
      return setSimCount(code, remaining);
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: [code] });
    },
  });
  const simCount = queryData.data;
  const status = queryData.status;
  useEffect(() => {
    if (status === "success") {
      if (simCount === -1 && typeof code === "string") {
        mutation.mutate({ code, remaining: 2 });
        localStorage.clear();
      }
    }
  }, [simCount, status, code]);

  return {
    ...queryData,
    takeSimCount() {
      if (!simCount || simCount === 0) {
        return;
      }
      mutation.mutate({ code, remaining: simCount - 1 });
    },
  };
}
