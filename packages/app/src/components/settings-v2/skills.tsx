import type { SkillV2Info } from "@opencode-ai/sdk/v2/client"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useQuery } from "@tanstack/solid-query"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { SettingsListV2 } from "./parts/list"
import { filterSettingsSkills, loadSettingsSkills } from "./skills-model"
import "./settings-v2.css"

type Translate = (key: string) => string

/**
 * Renders the project-scoped Skill registry tab for Settings v2.
 */
export function SettingsSkillsV2() {
  const language = useLanguage()
  const server = useServer()
  const serverSDK = useServerSDK()
  const directory = createMemo(() => server.projects.last() ?? server.projects.list()[0]?.worktree)
  const [filter, setFilter] = createSignal("")
  const skills = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "runtime-skills"] as const,
    enabled: !!directory(),
    queryFn: () => loadSettingsSkills(directory(), serverSDK().client),
  }))
  const items = createMemo(() => filterSettingsSkills(skills.data ?? [], filter()))

  return (
    <>
      <SettingsSkillsHeader t={language.t} filter={filter()} onInput={setFilter} onClear={() => setFilter("")} />
      <SettingsSkillsBody
        directory={directory()}
        filter={filter()}
        items={items()}
        loading={skills.isLoading}
        t={language.t}
      />
    </>
  )
}

function SettingsSkillsHeader(props: {
  t: Translate
  filter: string
  onInput: (value: string) => void
  onClear: () => void
}) {
  return (
    <div class="settings-v2-tab-header settings-v2-tab-header--stacked">
      <h2 class="settings-v2-tab-title">{props.t("settings.skills.title")}</h2>
      <div class="settings-v2-tab-search">
        <TextInputV2
          type="search"
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
  items: SkillV2Info[]
  loading: boolean
  t: Translate
}) {
  return (
    <div class="settings-v2-tab-body settings-v2-skills">
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
              when={props.items.length > 0}
              fallback={<SettingsSkillsEmpty filter={props.filter} t={props.t} />}
            >
              <For each={props.items}>{(item) => <SettingsSkillRow item={item} t={props.t} />}</For>
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

function SettingsSkillRow(props: { item: SkillV2Info; t: Translate }) {
  return (
    <div class="settings-v2-skill-row">
      <div class="settings-v2-skill-copy">
        <div class="settings-v2-skill-main">
          <span class="settings-v2-skill-name truncate">{props.item.name}</span>
          <Show when={props.item.slash}>
            <Tag>{props.t("settings.skills.tag.slash")}</Tag>
          </Show>
        </div>
        <Show when={props.item.description}>
          {(description) => <p class="settings-v2-skill-description">{description()}</p>}
        </Show>
        <span class="settings-v2-skill-location">
          {props.t("settings.skills.location")}: {props.item.location}
        </span>
      </div>
    </div>
  )
}
