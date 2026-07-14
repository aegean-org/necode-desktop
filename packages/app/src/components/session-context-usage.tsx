import { Match, Show, Switch, createMemo } from "solid-js"
import { useQuery } from "@tanstack/solid-query"
import { Tooltip, type TooltipProps } from "@opencode-ai/ui/tooltip"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { Button } from "@opencode-ai/ui/button"

import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useProviders } from "@/hooks/use-providers"
import { getSessionContextMetrics } from "@/components/session/session-context-metrics"
import { useSessionLayout } from "@/pages/session/session-layout"
import { createSessionTabs } from "@/pages/session/helpers"

interface SessionContextUsageProps {
  variant?: "button" | "indicator"
  placement?: TooltipProps["placement"]
}

function openSessionContext(args: {
  view: ReturnType<ReturnType<typeof useLayout>["view"]>
  layout: ReturnType<typeof useLayout>
  tabs: ReturnType<ReturnType<typeof useLayout>["tabs"]>
}) {
  if (!args.view.reviewPanel.opened()) args.view.reviewPanel.open()
  if (args.layout.fileTree.opened() && args.layout.fileTree.tab() !== "all") args.layout.fileTree.setTab("all")
  void args.tabs.open("context")
  args.tabs.setActive("context")
}

export function SessionContextUsage(props: SessionContextUsageProps) {
  const sync = useSync()
  const file = useFile()
  const layout = useLayout()
  const language = useLanguage()
  const sdk = useSDK()
  const providers = useProviders()
  const { params, tabs, view } = useSessionLayout()

  const variant = createMemo(() => props.variant ?? "button")
  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? file.tab(tab) : tab),
  })
  const messages = createMemo(() => (params.id ? (sync().data.message[params.id] ?? []) : []))
  const session = createMemo(() => sync().data.session.find((item) => item.id === params.id))

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )
  const compute = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        maximumFractionDigits: 2,
      }),
  )

  const metrics = createMemo(() =>
    getSessionContextMetrics(messages(), [...providers.all().values()], session()?.tokens),
  )
  const context = createMemo(() => metrics().context)
  const account = useQuery(() => ({
    queryKey: [sdk().scope, sdk().directory, "ne-token-account", context()?.message.id] as const,
    enabled: metrics().billing === "compute",
    retry: false,
    staleTime: 30_000,
    queryFn: () => sdk().client.provider.neAccount().then((result) => result.data),
  }))
  const cost = createMemo(() => {
    return usd().format(metrics().totalCost)
  })

  const openContext = () => {
    if (!params.id) return

    if (tabState.activeTab() === "context") {
      tabs().close("context")
      return
    }
    openSessionContext({
      view: view(),
      layout,
      tabs: tabs(),
    })
  }

  const circle = () => (
    <div class="flex items-center justify-center">
      <ProgressCircle size={16} strokeWidth={2} percentage={context()?.usage ?? 0} />
    </div>
  )

  const tooltipValue = () => (
    <div>
      <Show when={context()}>
        {(ctx) => (
          <>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().total.toLocaleString(language.intl())}</span>
              <span class="text-text-invert-base">{language.t("context.usage.tokens")}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().usage ?? 0}%</span>
              <span class="text-text-invert-base">{language.t("context.usage.usage")}</span>
            </div>
          </>
        )}
      </Show>
      <Show when={metrics().showSessionTotal}>
        <div class="flex items-center gap-2">
          <span class="text-text-invert-strong">{metrics().sessionTotal.toLocaleString(language.intl())}</span>
          <span class="text-text-invert-base">{language.t("context.usage.sessionTokens")}</span>
        </div>
      </Show>
      <Switch>
        <Match when={metrics().billing === "compute"}>
          <Show
            when={account.data}
            fallback={
              <div class="text-text-invert-base">
                {language.t(account.isPending ? "context.usage.computeLoading" : "context.usage.computeUnavailable")}
              </div>
            }
          >
            {(value) => (
              <>
                <div class="flex items-center gap-2">
                  <span class="text-text-invert-strong">{compute().format(value().remaining)}</span>
                  <span class="text-text-invert-base">{language.t("context.usage.computeRemaining")}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-text-invert-strong">{compute().format(value().totalConsumed)}</span>
                  <span class="text-text-invert-base">{language.t("context.usage.computeConsumed")}</span>
                </div>
                <div class="mt-1 text-xs text-text-invert-weak">{language.t("context.usage.computeDelayed")}</div>
              </>
            )}
          </Show>
        </Match>
        <Match when={true}>
          <div class="flex items-center gap-2">
            <span class="text-text-invert-strong">{cost()}</span>
            <span class="text-text-invert-base">{language.t("context.usage.cost")}</span>
          </div>
        </Match>
      </Switch>
    </div>
  )

  return (
    <Show when={params.id}>
      <Tooltip value={tooltipValue()} placement={props.placement ?? "top"}>
        <Switch>
          <Match when={variant() === "indicator"}>{circle()}</Match>
          <Match when={true}>
            <Button
              type="button"
              variant="ghost"
              class="size-6"
              onClick={openContext}
              aria-label={language.t("context.usage.view")}
            >
              {circle()}
            </Button>
          </Match>
        </Switch>
      </Tooltip>
    </Show>
  )
}
