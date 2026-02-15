import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { ActiveRunContext, Project } from '@shared/types';
import {
  DEFAULT_PROJECT_FORM,
  type ProjectFormMode,
  type ProjectFormState,
} from '../types';
import { toErrorMessage, validateBaseUrl } from '../utils';

interface UseProjectsDomainArgs {
  activeRunContext: ActiveRunContext | null;
  onMessage: (message: string) => void;
}

export interface UseProjectsDomainResult {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  selectedProject: Project | null;
  projectForm: ProjectFormState;
  setProjectForm: Dispatch<SetStateAction<ProjectFormState>>;
  projectFormMode: ProjectFormMode;
  isProjectFormOpen: boolean;
  projectNameError: string | null;
  projectBaseUrlError: string | null;
  canSaveProject: boolean;
  isSelectedProjectDeleteBlocked: boolean;
  refreshProjects: (preferredProjectId?: string) => Promise<Project[]>;
  beginCreateProject: () => void;
  beginEditSelectedProject: () => void;
  closeProjectForm: () => void;
  createProject: () => Promise<Project | null>;
  updateSelectedProject: () => Promise<Project | null>;
  deleteSelectedProject: (onProjectDeleted: () => Promise<void>) => Promise<boolean>;
}

export function useProjectsDomain({
  activeRunContext,
  onMessage,
}: UseProjectsDomainArgs): UseProjectsDomainResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectForm, setProjectForm] = useState<ProjectFormState>(DEFAULT_PROJECT_FORM);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>('create');
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectNameError = projectForm.name.trim() ? null : 'Project name is required.';
  const projectBaseUrlError = validateBaseUrl(projectForm.baseUrl);
  const canSaveProject = !projectNameError && !projectBaseUrlError;

  const isSelectedProjectDeleteBlocked =
    Boolean(selectedProjectId) && activeRunContext?.projectId === selectedProjectId;

  const refreshProjects = useCallback(
    async (preferredProjectId: string = selectedProjectId): Promise<Project[]> => {
      let result: Awaited<ReturnType<typeof window.qaApi.projectList>>;
      try {
        result = await window.qaApi.projectList();
      } catch (error) {
        onMessage(`Failed loading projects: ${toErrorMessage(error)}`);
        return [];
      }

      if (!result.ok) {
        onMessage(result.error.message);
        return [];
      }

      const rows = result.data;
      setProjects(rows);

      let nextProjectId = preferredProjectId;
      if (rows.length === 0) {
        nextProjectId = '';
      } else if (!rows.some((project) => project.id === preferredProjectId)) {
        nextProjectId = rows[0].id;
      }

      setSelectedProjectId(nextProjectId);
      return rows;
    },
    [onMessage, selectedProjectId],
  );

  const beginCreateProject = useCallback(() => {
    setProjectFormMode('create');
    setProjectForm(DEFAULT_PROJECT_FORM);
    setIsProjectFormOpen(true);
  }, []);

  const beginEditSelectedProject = useCallback(() => {
    if (!selectedProject) {
      onMessage('Select a project first.');
      return;
    }

    setProjectFormMode('edit');
    setProjectForm({
      id: selectedProject.id,
      name: selectedProject.name,
      baseUrl: selectedProject.baseUrl,
      envLabel: selectedProject.envLabel,
    });
    setIsProjectFormOpen(true);
  }, [onMessage, selectedProject]);

  const closeProjectForm = useCallback(() => {
    setIsProjectFormOpen(false);
    setProjectFormMode('create');
  }, []);

  const createProject = useCallback(async (): Promise<Project | null> => {
    if (!canSaveProject) {
      onMessage(projectNameError ?? projectBaseUrlError ?? 'Fix project validation errors.');
      return null;
    }

    const payload = {
      name: projectForm.name.trim(),
      baseUrl: projectForm.baseUrl.trim(),
      envLabel: projectForm.envLabel.trim() || 'local',
      metadata: {},
    };

    let result: Awaited<ReturnType<typeof window.qaApi.projectCreate>>;
    try {
      result = await window.qaApi.projectCreate(payload);
    } catch (error) {
      onMessage(`Create project failed: ${toErrorMessage(error)}`);
      return null;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    setProjects((previous) => {
      const exists = previous.some((project) => project.id === result.data.id);
      if (exists) {
        return previous;
      }

      return [result.data, ...previous];
    });
    setSelectedProjectId(result.data.id);

    setProjectForm({
      id: result.data.id,
      name: result.data.name,
      baseUrl: result.data.baseUrl,
      envLabel: result.data.envLabel,
    });
    setIsProjectFormOpen(false);
    setProjectFormMode('create');

    return result.data;
  }, [
    canSaveProject,
    onMessage,
    projectBaseUrlError,
    projectForm.baseUrl,
    projectForm.envLabel,
    projectForm.name,
    projectNameError,
  ]);

  const updateSelectedProject = useCallback(async (): Promise<Project | null> => {
    if (!selectedProject) {
      onMessage('Select a project first.');
      return null;
    }

    if (!canSaveProject) {
      onMessage(projectNameError ?? projectBaseUrlError ?? 'Fix project validation errors.');
      return null;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.projectUpdate>>;
    try {
      result = await window.qaApi.projectUpdate({
        id: selectedProject.id,
        name: projectForm.name.trim(),
        baseUrl: projectForm.baseUrl.trim(),
        envLabel: projectForm.envLabel.trim() || 'local',
        metadata: {},
      });
    } catch (error) {
      onMessage(`Update project failed: ${toErrorMessage(error)}`);
      return null;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    setProjectForm({
      id: result.data.id,
      name: result.data.name,
      baseUrl: result.data.baseUrl,
      envLabel: result.data.envLabel,
    });
    setIsProjectFormOpen(false);
    setProjectFormMode('create');

    return result.data;
  }, [
    canSaveProject,
    onMessage,
    projectBaseUrlError,
    projectForm.baseUrl,
    projectForm.envLabel,
    projectForm.name,
    projectNameError,
    selectedProject,
  ]);

  const deleteSelectedProject = useCallback(async (onProjectDeleted: () => Promise<void>): Promise<boolean> => {
    if (!selectedProjectId) {
      onMessage('Select a project first.');
      return false;
    }

    if (activeRunContext?.projectId === selectedProjectId) {
      onMessage('Cannot delete this project while its run is active.');
      return false;
    }

    if (!window.confirm('Delete this project and all related tests/runs?')) {
      return false;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.projectDelete>>;
    try {
      result = await window.qaApi.projectDelete(selectedProjectId);
    } catch (error) {
      onMessage(`Delete project failed: ${toErrorMessage(error)}`);
      return false;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return false;
    }

    beginCreateProject();
    setIsProjectFormOpen(false);
    await onProjectDeleted();
    onMessage(result.data ? 'Project deleted.' : 'Project was already deleted.');
    return true;
  }, [activeRunContext?.projectId, beginCreateProject, onMessage, selectedProjectId]);

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    projectForm,
    setProjectForm,
    projectFormMode,
    isProjectFormOpen,
    projectNameError,
    projectBaseUrlError,
    canSaveProject,
    isSelectedProjectDeleteBlocked,
    refreshProjects,
    beginCreateProject,
    beginEditSelectedProject,
    closeProjectForm,
    createProject,
    updateSelectedProject,
    deleteSelectedProject,
  };
}
