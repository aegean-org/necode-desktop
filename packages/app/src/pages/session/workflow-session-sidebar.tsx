import { For, Show, createMemo } from "solid-js"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { WORKFLOW_NAV_ROW, WorkflowSectionHeader } from "@/components/workflow-ui"
import { getProjectAvatarVariant, type LocalProject } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { displayName, getProjectAvatarSource } from "@/pages/layout/helpers"
import { HomeWorkflowNav } from "@/pages/home/workflow-sidebar"
import type { WorkflowTask, WorkflowTaskFilter } from "@/pages/home/workflow-task"

const PROJECT_LABEL = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"

/** Primary workflow sidebar shared by the session workspace shell. */
export function WorkflowSessionSidebar(props: {
  projects: LocalProject[]
  activeDirectory: string
  tasks: WorkflowTask[]
  filter: WorkflowTaskFilter
  onFilter: (filter: WorkflowTaskFilter) => void
  onOpenProject: (directory: string) => void
  onNewSession: (directory: string) => void
  onOpenSettings: () => void
}) {
  const language = useLanguage()
  return (
    <aside class="flex min-h-0 min-w-0 flex-col gap-5 overflow-hidden px-3 pb-4 pt-3" aria-label={language.t("home.tasks.workflow")}>
      <HomeWorkflowNav tasks={props.tasks} filter={props.filter} onFilter={props.onFilter} />
      <div class="mx-1 h-px bg-v2-border-border-muted" aria-hidden="true" />
      <WorkflowSessionProjectSection
        projects={props.projects}
        activeDirectory={props.activeDirectory}
        onOpenProject={props.onOpenProject}
        onNewSession={props.onNewSession}
      />
      <WorkflowSessionFooterActions onOpenSettings={props.onOpenSettings} />
    </aside>
  )
}

function WorkflowSessionProjectSection(props: {
  projects: LocalProject[]
  activeDirectory: string
  onOpenProject: (directory: string) => void
  onNewSession: (directory: string) => void
}) {
  const language = useLanguage()
  const activeProject = createMemo(() => props.projects.find((project) => isActiveProject(project, props.activeDirectory)))

  return (
    <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <WorkflowSectionHeader
        class="!h-7 !px-1.5"
        title={language.t("home.projects")}
        actions={
          <Show when={activeProject()}>
            {(project) => (
              <IconButtonV2
                data-action="session-project-new-session"
                variant="ghost-muted"
                size="large"
                class="titlebar-icon [&_[data-slot=icon-svg]]:text-v2-icon-icon-muted"
                icon={<Icon name="edit" />}
                onClick={() => props.onNewSession(project().worktree)}
                aria-label={language.t("command.session.new")}
              />
            )}
          </Show>
        }
      />

      <div class="flex min-w-0 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <For each={props.projects}>
          {(project) => (
            <ProjectRow
              project={project}
              selected={isActiveProject(project, props.activeDirectory)}
              onOpenProject={props.onOpenProject}
              onNewSession={props.onNewSession}
            />
          )}
        </For>
      </div>
    </section>
  )
}

function WorkflowSessionFooterActions(props: { onOpenSettings: () => void }) {
  const language = useLanguage()

  return (
    <div class="flex min-w-0 flex-col gap-1">
      <button type="button" class={`${WORKFLOW_NAV_ROW} text-v2-text-text-faint`} onClick={props.onOpenSettings}>
        <Icon name="settings-gear" size="small" class="text-v2-icon-icon-muted" />
        <span class={PROJECT_LABEL}>{language.t("sidebar.settings")}</span>
      </button>
    </div>
  )
}

function ProjectRow(props: {
  project: LocalProject
  selected: boolean
  onOpenProject: (directory: string) => void
  onNewSession: (directory: string) => void
}) {
  const language = useLanguage()
  const name = createMemo(() => displayName(props.project))
  return (
    <div class="group/project relative flex h-7 min-w-0 items-center rounded-[6px]">
      <button
        type="button"
        data-component="session-workflow-project-row"
        data-selected={props.selected ? "" : undefined}
        class={`${WORKFLOW_NAV_ROW} pr-9`}
        onClick={() => props.onOpenProject(props.project.worktree)}
      >
        <ProjectAvatar
          fallback={name()}
          src={getProjectAvatarSource(props.project.id, props.project.icon)}
          variant={getProjectAvatarVariant(props.project.icon?.color)}
        />
        <span class={PROJECT_LABEL}>{name()}</span>
      </button>
      <IconButtonV2
        data-action="session-project-row-new-session"
        variant="ghost-muted"
        size="small"
        class="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/project:opacity-100 focus:opacity-100"
        icon={<Icon name="edit" />}
        aria-label={language.t("command.session.new")}
        onClick={() => props.onNewSession(props.project.worktree)}
      />
    </div>
  )
}

function isActiveProject(project: LocalProject, directory: string) {
  return project.worktree === directory || !!project.sandboxes?.includes(directory)
}
