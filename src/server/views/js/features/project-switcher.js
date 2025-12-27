// Project Switcher - Multi-project management UI

/**
 * Initialize project switcher
 */
export async function initProjectSwitcher() {
    // Load initial project list
    await loadProjects();
    
    // Poll for project updates every 5 seconds
    setInterval(loadProjects, 5000);
    
    // Listen for socket events
    setupSocketListeners();
}

/**
 * Load and display all projects
 */
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        updateProjectSelector(data.projects, data.activeProjectId);
        updateProjectCount(data.totalProjects);
        
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

/**
 * Update project selector dropdown
 */
function updateProjectSelector(projects, activeProjectId) {
    const selector = document.getElementById('project-selector');
    if (!selector) return;
    
    // Clear existing options
    selector.innerHTML = '';
    
    // Add projects
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        option.selected = project.id === activeProjectId;
        selector.appendChild(option);
    });
}

/**
 * Update project count badge
 */
function updateProjectCount(count) {
    const badge = document.getElementById('project-count');
    if (!badge) return;
    
    badge.textContent = `${count} project${count !== 1 ? 's' : ''}`;
}

/**
 * Switch to a different project
 */
export async function switchProject(projectId) {
    try {
        const response = await fetch('/api/projects/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Emit custom event for other components to react
            const event = new CustomEvent('project-switched', {
                detail: {
                    projectId,
                    projectName: data.project.name,
                    project: data.project
                }
            });
            window.dispatchEvent(event);
            
            // Show toast
            showToast(`Switched to: ${data.project.name}`, 'success');
        } else {
            showToast('Failed to switch project', 'error');
        }
    } catch (error) {
        console.error('Failed to switch project:', error);
        showToast('Error switching project', 'error');
    }
}

/**
 * Setup socket listeners for real-time updates
 */
function setupSocketListeners() {
    if (typeof io === 'undefined') return;
    
    const socket = io();
    
    // New project registered
    socket.on('project:registered', (data) => {
        console.log('New project registered:', data);
        loadProjects();
        showToast(`New project joined: ${data.name}`, 'info');
    });
    
    // Project switched
    socket.on('project:switched', (data) => {
        console.log('Project switched:', data);
        loadProjects();
    });
    
    // Project removed
    socket.on('project:removed', (data) => {
        console.log('Project removed:', data);
        loadProjects();
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast show';
    
    if (type === 'success') {
        toast.style.background = '#28a745';
    } else if (type === 'error') {
        toast.style.background = '#dc3545';
    } else if (type === 'warning') {
        toast.style.background = '#ffc107';
        toast.style.color = '#000';
    } else {
        toast.style.background = '#007bff';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Export for global access
window.switchProject = switchProject;
