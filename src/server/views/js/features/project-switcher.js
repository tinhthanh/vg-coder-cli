import { API_BASE } from '../config.js';
import { getById, showToast } from '../utils.js';

export async function initProjectSwitcher() {
    await loadProjects();
    setInterval(loadProjects, 5000);
    setupSocketListeners();
}

async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const data = await response.json();
        
        updateProjectSelector(data.projects, data.activeProjectId);
        updateProjectCount(data.totalProjects);
        
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

function updateProjectSelector(projects, activeProjectId) {
    const selector = getById('project-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        option.selected = project.id === activeProjectId;
        selector.appendChild(option);
    });
}

function updateProjectCount(count) {
    const badge = getById('project-count');
    if (!badge) return;
    
    badge.textContent = `${count} project${count !== 1 ? 's' : ''}`;
}

export async function switchProject(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/projects/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const event = new CustomEvent('project-switched', {
                detail: {
                    projectId,
                    projectName: data.project.name,
                    project: data.project
                }
            });
            window.dispatchEvent(event);
            
            showToast(`Switched to: ${data.project.name}`, 'success');
        } else {
            showToast('Failed to switch project', 'error');
        }
    } catch (error) {
        console.error('Failed to switch project:', error);
        showToast('Error switching project', 'error');
    }
}

function setupSocketListeners() {
    if (typeof io === 'undefined') return;
    
    const socket = io(API_BASE);
    
    socket.on('project:registered', (data) => {
        console.log('New project registered:', data);
        loadProjects();
        showToast(`New project joined: ${data.name}`, 'info');
    });
    
    socket.on('project:switched', (data) => {
        console.log('Project switched:', data);
        loadProjects();
    });
    
    socket.on('project:removed', (data) => {
        console.log('Project removed:', data);
        loadProjects();
    });
}

window.switchProject = switchProject;
