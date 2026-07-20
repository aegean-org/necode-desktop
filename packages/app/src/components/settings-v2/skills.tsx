import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { useParams } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { decode64 } from "@/utils/base64"
import { SettingsListV2 } from "./parts/list"
import { DialogSkillInstall } from "./dialog-skill-install"
import { DialogSkillRemove } from "./dialog-skill-remove"
import {
  changedSettingsSkills,
  filterSettingsSkills,
  installSettingsSkill,
  loadSettingsSkills,
  removeSettingsSkill,
  type SettingsSkillInfo,
} from "./skills-model"
import "./settings-v2.css"

type Translate = ReturnType<typeof useLanguage>["t"]

/**
 * Renders the project-scoped Skill registry tab for Settings v2.
 */
export function SettingsSkillsV2(props: { directory?: string }) {
  const language = useLanguage()
  const server = useServer()
  const serverSDK = useServerSDK()
  const dialog = useDialog()
  const params = useParams()
  const directory = createMemo(
    () => props.directory ?? decode64(params.dir) ?? server.projects.last() ?? server.projects.list()[0]?.worktree,
  )
  const [filter, setFilter] = createSignal("")
  const [recentlyInstalled, setRecentlyInstalled] = createSignal<SettingsSkillInfo[]>([])
  const [installFeedback, setInstallFeedback] = createSignal<number>()
  let previousDirectory = directory()
  createEffect(() => {
    const next = directory()
    if (next === previousDirectory) return
    previousDirectory = next
    setRecentlyInstalled([])
    setInstallFeedback(undefined)
  })
  const skills = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "runtime-skills"] as const,
    enabled: !!directory(),
    queryFn: () => loadSettingsSkills(directory(), serverSDK().client),
    refetchOnMount: "always",
  }))
  const visible = createMemo(() => filterSettingsSkills(skills.data ?? [], filter()))
  const recentItems = createMemo(() =>
    visible().filter((item) =>
      recentlyInstalled().some(
        (recent) => recent.name === item.name && recent.location === item.location && item.canUninstall,
      ),
    ),
  )
  const items = createMemo(() =>
    visible().filter(
      (item) => !recentItems().some((recent) => recent.name === item.name && recent.location === item.location),
    ),
  )
  const install = useMutation(() => ({
    mutationFn: async (input: Parameters<typeof installSettingsSkill>[2]) => {
      const next = await installSettingsSkill(directory(), serverSDK().client, input)
      const changed = changedSettingsSkills(skills.data ?? [], next)
      await skills.refetch()
      setRecentlyInstalled(changed)
      setInstallFeedback(changed.length)
    },
  }))
  const remove = useMutation(() => ({
    mutationFn: async (item: SettingsSkillInfo) => {
      await removeSettingsSkill(directory(), serverSDK().client, item.name)
      await skills.refetch()
    },
  }))
  const openInstall = () => dialog.push(() => <DialogSkillInstall onSubmit={install.mutateAsync} />)
  const openRemove = (item: SettingsSkillInfo) => {
    if (!item.canUninstall) throw new Error(`Skill cannot be removed: ${item.name}`)
    dialog.push(() => <DialogSkillRemove item={item} onConfirm={() => remove.mutateAsync(item)} />)
  }

  return (
    <>
      <SettingsSkillsHeader
        t={language.t}
        filter={filter()}
        onInput={(value) => {
          setFilter(value)
          setRecentlyInstalled([])
          setInstallFeedback(undefined)
        }}
        onClear={() => setFilter("")}
        onInstall={openInstall}
        installDisabled={!directory()}
      />
      <SettingsSkillsBody
        directory={directory()}
        filter={filter()}
        installFeedback={installFeedback()}
        recentItems={recentItems()}
        items={items()}
        loading={skills.isLoading}
        t={language.t}
        onRemove={openRemove}
      />
    </>
  )
}

function SettingsSkillsHeader(props: {
  t: Translate
  filter: string
  onInput: (value: string) => void
  onClear: () => void
  onInstall: () => void
  installDisabled: boolean
}) {
  return (
    <div class="settings-v2-tab-header settings-v2-tab-header--stacked">
      <div class="settings-v2-tab-header-row">
        <h2 class="settings-v2-tab-title">{props.t("settings.skills.title")}</h2>
        <ButtonV2 variant="ghost-muted" icon="plus" disabled={props.installDisabled} onClick={props.onInstall}>
          {props.t("settings.skills.action.install")}
        </ButtonV2>
      </div>
      <div class="settings-v2-tab-search">
        <TextInputV2
          type="text"
          role="searchbox"
          appearance="base"
          value={props.filter}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          placeholder={props.t("settings.skills.search.placeholder")}
          spellcheck={false}
          autocorrect="off"
          autocomplete="off"
          autocapitalize="off"
          aria-label={props.t("settings.skills.search.placeholder")}
        />
        <Show when={props.filter}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            class="settings-v2-tab-search-clear"
            icon={<Icon name="close" size="large" class="text-v2-icon-icon-muted" />}
            onClick={props.onClear}
          />
        </Show>
      </div>
    </div>
  )
}

function SettingsSkillsBody(props: {
  directory?: string
  filter: string
  installFeedback?: number
  recentItems: SettingsSkillInfo[]
  items: SettingsSkillInfo[]
  loading: boolean
  t: Translate
  onRemove: (item: SettingsSkillInfo) => void
}) {
  return (
    <div class="settings-v2-tab-body settings-v2-skills">
      <Show when={props.installFeedback !== undefined}>
        <div class="settings-v2-skill-install-success" role="status" aria-live="polite">
          <span class="settings-v2-skill-install-success-dot" />
          <div>
            <strong>{props.t("settings.skills.toast.installed.title")}</strong>
            <span>
              {props.t(
                props.installFeedback
                  ? "settings.skills.toast.installed.description"
                  : "settings.skills.toast.installed.unchanged",
                { count: props.installFeedback ?? 0 },
              )}
            </span>
          </div>
        </div>
      </Show>
      <SettingsListV2>
        <Show
          when={props.directory}
          fallback={<div class="settings-v2-skills-status">{props.t("settings.skills.noProject")}</div>}
        >
          <Show
            when={!props.loading}
            fallback={
              <div class="settings-v2-skills-status">
                {props.t("common.loading")}
                {props.t("common.loading.ellipsis")}
              </div>
            }
          >
            <Show
              when={props.recentItems.length + props.items.length > 0}
              fallback={<SettingsSkillsEmpty filter={props.filter} t={props.t} />}
            >
              <Show when={props.recentItems.length > 0}>
                <div class="settings-v2-skill-section-label">
                  {props.t("settings.skills.section.recent", { count: props.recentItems.length })}
                </div>
                <For each={props.recentItems}>
                  {(item) => <SettingsSkillRow item={item} t={props.t} onRemove={props.onRemove} />}
                </For>
                <Show when={props.items.length > 0}>
                  <div class="settings-v2-skill-section-label settings-v2-skill-section-label--other">
                    {props.t("settings.skills.section.other")}
                  </div>
                </Show>
              </Show>
              <For each={props.items}>
                {(item) => <SettingsSkillRow item={item} t={props.t} onRemove={props.onRemove} />}
              </For>
            </Show>
          </Show>
        </Show>
      </SettingsListV2>
    </div>
  )
}

function SettingsSkillsEmpty(props: { filter: string; t: Translate }) {
  return (
    <div class="settings-v2-skills-status">
      <span>{props.t("settings.skills.empty")}</span>
      <Show when={props.filter}>
        <span class="settings-v2-skills-status-filter">&quot;{props.filter}&quot;</span>
      </Show>
    </div>
  )
}

function SettingsSkillRow(props: {
  item: SettingsSkillInfo
  t: Translate
  onRemove: (item: SettingsSkillInfo) => void
}) {
  return (
    <div class="settings-v2-skill-row">
      <div class="settings-v2-skill-copy">
        <div class="settings-v2-skill-main">
          <span class="settings-v2-skill-name truncate">{props.item.name}</span>
          <Show when={props.item.slash}>
            <Tag>{props.t("settings.skills.tag.slash")}</Tag>
          </Show>
          <Show when={props.item.source}>{(source) => <Tag>{props.t(`settings.skills.source.${source()}`)}</Tag>}</Show>
          <Show when={props.item.scope === "local" || props.item.scope === "global"}>
            <Tag>{props.t(`settings.skills.scope.${props.item.scope}`)}</Tag>
          </Show>
        </div>
        <Show when={props.item.description}>
          {(description) => <p class="settings-v2-skill-description">{description()}</p>}
        </Show>
        <span class="settings-v2-skill-location">
          {props.t("settings.skills.location")}: {props.item.location}
        </span>
      </div>
      <Show when={props.item.canUninstall}>
        <MenuV2 gutter={4} modal={false} placement="bottom-end">
          <MenuV2.Trigger
            as={IconButtonV2}
            variant="ghost-muted"
            size="small"
            icon={<Icon name="outline-dots" />}
            aria-label={props.t("common.moreOptions")}
          />
          <MenuV2.Portal>
            <MenuV2.Content>
              <MenuV2.Item onSelect={() => props.onRemove(props.item)}>
                {props.t("settings.skills.action.remove")}
              </MenuV2.Item>
            </MenuV2.Content>
          </MenuV2.Portal>
        </MenuV2>
      </Show>
    </div>
  )
}
