// Database configuration for Supabase
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG } from './supabase-config.js'

// Create Supabase client
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

// Database service class
export class DatabaseService {
    constructor() {
        this.client = supabase
    }

    // Projects
    async getProjects() {
        const { data, error } = await this.client
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data
    }

    async createProject(projectData) {
        const { data, error } = await this.client
            .from('projects')
            .insert([projectData])
            .select()
        
        if (error) throw error
        return data[0]
    }

    async updateProject(id, projectData) {
        const { data, error } = await this.client
            .from('projects')
            .update(projectData)
            .eq('id', id)
            .select()
        
        if (error) throw error
        return data[0]
    }

    async deleteProject(id) {
        const { error } = await this.client
            .from('projects')
            .delete()
            .eq('id', id)
        
        if (error) throw error
        return true
    }

    // Project Phases
    async getProjectPhases(projectId) {
        const { data, error } = await this.client
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('phase_order', { ascending: true })
        
        if (error) throw error
        return data
    }

    async createProjectPhase(phaseData) {
        const { data, error } = await this.client
            .from('project_phases')
            .insert([phaseData])
            .select()
        
        if (error) throw error
        return data[0]
    }

    async updateProjectPhase(id, phaseData) {
        const { data, error } = await this.client
            .from('project_phases')
            .update(phaseData)
            .eq('id', id)
            .select()
        
        if (error) throw error
        return data[0]
    }

    async deleteProjectPhase(id) {
        const { error } = await this.client
            .from('project_phases')
            .delete()
            .eq('id', id)
        
        if (error) throw error
        return true
    }

    // Project Spaces
    async getProjectSpaces(projectId) {
        const { data, error } = await this.client
            .from('project_spaces')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data
    }

    async createProjectSpace(spaceData) {
        const { data, error } = await this.client
            .from('project_spaces')
            .insert([spaceData])
            .select()
        
        if (error) throw error
        return data[0]
    }

    async updateProjectSpace(id, spaceData) {
        const { data, error } = await this.client
            .from('project_spaces')
            .update(spaceData)
            .eq('id', id)
            .select()
        
        if (error) throw error
        return data[0]
    }

    async deleteProjectSpace(id) {
        const { error } = await this.client
            .from('project_spaces')
            .delete()
            .eq('id', id)
        
        if (error) throw error
        return true
    }

    // Phase Space Assignments
    async getPhaseSpaceAssignments(projectId) {
        const { data, error } = await this.client
            .from('phase_space_assignments')
            .select(`
                *,
                project_spaces(*),
                project_phases(*)
            `)
            .eq('project_spaces.project_id', projectId)
        
        if (error) throw error
        return data
    }

    async createPhaseSpaceAssignment(assignmentData) {
        const { data, error } = await this.client
            .from('phase_space_assignments')
            .insert([assignmentData])
            .select()
        
        if (error) throw error
        return data[0]
    }

    async deletePhaseSpaceAssignment(spaceId, phaseId) {
        const { error } = await this.client
            .from('phase_space_assignments')
            .delete()
            .eq('project_space_id', spaceId)
            .eq('project_phase_id', phaseId)
        
        if (error) throw error
        return true
    }

    // Utility methods
    async getProjectWithPhasesAndSpaces(projectId) {
        const { data, error } = await this.client
            .from('projects')
            .select(`
                *,
                project_phases(*),
                project_spaces(*)
            `)
            .eq('id', projectId)
            .single()
        
        if (error) throw error
        return data
    }
}

// Create singleton instance
export const db = new DatabaseService()
