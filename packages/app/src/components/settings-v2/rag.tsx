import type { RagDocument, RagStatus } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { pickedRagPaths, ragStatusSummary } from "./rag-model"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

const RAG_FILE_EXTENSIONS = ["pdf", "md", "txt"]

/**
 * Renders the desktop-backed local document index settings tab.
 */
export function SettingsRagV2() {
  const language = useLanguage()
  const platform = usePlatform()
  const serverSDK = useServerSDK()
  const status = useQuery(() => ({
    queryKey: [serverSDK().scope, "settings", "rag"] as const,
    queryFn: () => serverSDK().client.rag.status().then((result) => result.data),
  }))
  const importer = useMutation(() => ({
    mutationFn: (inputPath: string) => serverSDK().client.rag.import({ path: inputPath }).then((result) => result.data),
  }))
  const documents = createMemo(() => status.data?.documents ?? [])
  const summary = createMemo(() => ragStatusSummary(status.data ?? emptyStatus()))

  const importPaths = async (input: Parameters<typeof pickedRagPaths>[0]) => {
    const paths = pickedRagPaths(input)
    if (paths.length === 0) return
    try {
      for (const inputPath of paths) await importer.mutateAsync(inputPath)
      await status.refetch()
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("settings.rag.toast.imported.title"),
        description: language.t("settings.rag.toast.imported.description", { count: paths.length }),
      })
    } catch (error) {
      void status.refetch()
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const chooseFiles = async () => {
    if (!platform.openFilePathPickerDialog) return showDesktopRequiredToast(language.t)
    await importPaths(
      await platform.openFilePathPickerDialog({
        title: language.t("settings.rag.dialog.chooseFiles"),
        multiple: true,
        extensions: RAG_FILE_EXTENSIONS,
      }),
    )
  }

  const chooseFolder = async () => {
    if (platform.platform !== "desktop") return showDesktopRequiredToast(language.t)
    await importPaths(
      await platform.openDirectoryPickerDialog({
        title: language.t("settings.rag.dialog.chooseFolder"),
        multiple: false,
      }),
    )
  }

  return (
    <>
      <div class="settings-v2-tab-header settings-v2-rag-header">
        <div class="settings-v2-tab-header-row">
          <h2 class="settings-v2-tab-title">{language.t("settings.rag.title")}</h2>
          <div class="settings-v2-rag-actions">
            <ButtonV2
              size="normal"
              variant="neutral"
              icon="plus"
              disabled={importer.isPending}
              onClick={() => void chooseFiles()}
            >
              {importer.isPending ? language.t("settings.rag.action.importing") : language.t("settings.rag.action.files")}
            </ButtonV2>
            <ButtonV2
              size="normal"
              variant="ghost-muted"
              icon="folder-add-left"
              disabled={importer.isPending}
              onClick={() => void chooseFolder()}
            >
              {language.t("settings.rag.action.folder")}
            </ButtonV2>
          </div>
        </div>
      </div>

      <div class="settings-v2-tab-body settings-v2-rag">
        <div class="settings-v2-rag-metrics">
          <RagMetric label={language.t("settings.rag.metric.documents")} value={summary().documents} />
          <RagMetric label={language.t("settings.rag.metric.chunks")} value={summary().chunks} />
        </div>

        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.rag.section.index")}</h3>
          <SettingsListV2>
            <RagStoreRow status={status.data} loading={status.isLoading} t={language.t} />
          </SettingsListV2>
        </div>

        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.rag.section.documents")}</h3>
          <SettingsListV2>
            <Show
              when={!status.isLoading}
              fallback={
                <div class="settings-v2-rag-status">
                  {language.t("common.loading")}
                  {language.t("common.loading.ellipsis")}
                </div>
              }
            >
              <Show
                when={documents().length > 0}
                fallback={<div class="settings-v2-rag-status">{language.t("settings.rag.empty")}</div>}
              >
                <For each={documents()}>{(item) => <RagDocumentRow item={item} />}</For>
              </Show>
            </Show>
          </SettingsListV2>
        </div>
      </div>
    </>
  )
}

function RagMetric(props: { label: string; value: number }) {
  return (
    <div class="settings-v2-rag-metric">
      <span class="settings-v2-rag-metric-value">{props.value}</span>
      <span class="settings-v2-rag-metric-label">{props.label}</span>
    </div>
  )
}

function RagStoreRow(props: { status: RagStatus | undefined; loading: boolean; t: (key: string) => string }) {
  return (
    <div class="settings-v2-rag-store-row">
      <div class="settings-v2-rag-doc-copy">
        <span class="settings-v2-rag-doc-name">{props.t("settings.rag.storePath")}</span>
        <span class="settings-v2-rag-doc-path">
          {props.loading ? `${props.t("common.loading")}${props.t("common.loading.ellipsis")}` : props.status?.storePath}
        </span>
      </div>
    </div>
  )
}

function RagDocumentRow(props: { item: RagDocument }) {
  return (
    <div class="settings-v2-rag-doc-row">
      <div class="settings-v2-rag-doc-copy">
        <div class="settings-v2-rag-doc-main">
          <span class="settings-v2-rag-doc-name truncate">{props.item.title}</span>
          <span class="settings-v2-rag-doc-chunks">{props.item.chunks} chunks</span>
        </div>
        <span class="settings-v2-rag-doc-path">{props.item.filePath}</span>
      </div>
    </div>
  )
}

function emptyStatus(): RagStatus {
  return { enabled: false, storePath: "", documents: [], chunks: 0 }
}

function showDesktopRequiredToast(t: (key: string) => string) {
  showToast({
    variant: "error",
    title: t("settings.rag.toast.desktopOnly.title"),
    description: t("settings.rag.toast.desktopOnly.description"),
  })
}
