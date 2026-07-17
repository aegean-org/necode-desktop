import { For, createMemo } from "solid-js"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
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
  onPinProject: (directory: string) => void
  onOpenProjectDirectory: (directory: string) => void
  onEditProject: (project: LocalProject) => void
  onRemoveProject: (directory: string) => void
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
        onPinProject={props.onPinProject}
        onOpenProjectDirectory={props.onOpenProjectDirectory}
        onEditProject={props.onEditProject}
        onRemoveProject={props.onRemoveProject}
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
  onPinProject: (directory: string) => void
  onOpenProjectDirectory: (directory: string) => void
  onEditProject: (project: LocalProject) => void
  onRemoveProject: (directory: string) => void
}) {
  const language = useLanguage()

  return (
    <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <WorkflowSectionHeader class="!h-7 !px-1.5" title={language.t("home.projects")} />

      <div class="flex min-w-0 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <For each={props.projects}>
          {(project, index) => (
            <ProjectRow
              project={project}
              index={index()}
              selected={isActiveProject(project, props.activeDirectory)}
              onOpenProject={props.onOpenProject}
              onNewSession={props.onNewSession}
              onPinProject={props.onPinProject}
              onOpenProjectDirectory={props.onOpenProjectDirectory}
              onEditProject={props.onEditProject}
              onRemoveProject={props.onRemoveProject}
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
  index: number
  selected: boolean
  onOpenProject: (directory: string) => void
  onNewSession: (directory: string) => void
  onPinProject: (directory: string) => void
  onOpenProjectDirectory: (directory: string) => void
  onEditProject: (project: LocalProject) => void
  onRemoveProject: (directory: string) => void
}) {
  const language = useLanguage()
  const name = createMemo(() => displayName(props.project))
  return (
    <div class="group/project relative flex h-7 min-w-0 items-center rounded-[6px]">
      <button
        type="button"
        data-component="session-workflow-project-row"
        data-selected={props.selected ? "" : undefined}
        class={`${WORKFLOW_NAV_ROW} pr-14`}
        onClick={() => props.onOpenProject(props.project.worktree)}
      >
        <ProjectAvatar
          fallback={name()}
          src={getProjectAvatarSource(props.project.id, props.project.icon)}
          variant={getProjectAvatarVariant(props.project.icon?.color)}
        />
        <span class={PROJECT_LABEL}>{name()}</span>
      </button>
      <div class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/project:opacity-100 group-focus-within/project:opacity-100">
        <ProjectRowMenu {...props} />
        <IconButtonV2
          data-action="session-project-row-new-session"
          variant="ghost-muted"
          size="small"
          icon={<Icon name="edit" />}
          aria-label={language.t("command.session.new")}
          onClick={() => props.onNewSession(props.project.worktree)}
        />
      </div>
    </div>
  )
}

function ProjectRowMenu(props: {
  project: LocalProject
  index: number
  onPinProject: (directory: string) => void
  onOpenProjectDirectory: (directory: string) => void
  onEditProject: (project: LocalProject) => void
  onRemoveProject: (directory: string) => void
}) {
  const language = useLanguage()
  return (
    <DropdownMenu gutter={4} placement="bottom-start">
      <DropdownMenu.Trigger
        as={IconButtonV2}
        data-action="session-project-row-menu"
        variant="ghost-muted"
        size="small"
        icon={<Icon name="outline-dots" />}
        aria-label={language.t("common.moreOptions")}
      />
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="min-w-48">
          <DropdownMenu.Item disabled={props.index === 0} onSelect={() => props.onPinProject(props.project.worktree)}>
            <DropdownMenu.Icon><Icon name="pin" size="small" /></DropdownMenu.Icon>
            <DropdownMenu.ItemLabel>{language.t("project.action.pin")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => props.onOpenProjectDirectory(props.project.worktree)}>
            <DropdownMenu.Icon><Icon name="folder-add-left" size="small" /></DropdownMenu.Icon>
            <DropdownMenu.ItemLabel>{language.t("project.action.openInExplorer")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => props.onEditProject(props.project)}>
            <DropdownMenu.Icon><Icon name="edit" size="small" /></DropdownMenu.Icon>
            <DropdownMenu.ItemLabel>{language.t("common.edit")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => props.onRemoveProject(props.project.worktree)}>
            <DropdownMenu.Icon><Icon name="xmark-small" size="small" /></DropdownMenu.Icon>
            <DropdownMenu.ItemLabel>{language.t("project.removeFromNecode")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

function isActiveProject(project: LocalProject, directory: string) {
  return project.worktree === directory || !!project.sandboxes?.includes(directory)
}
