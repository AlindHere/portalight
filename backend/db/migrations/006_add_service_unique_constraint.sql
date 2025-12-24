-- Add unique constraint on project_id and name for services
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_project_name ON services(project_id, name);

-- Add unique constraint on catalog_file_path for projects
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_catalog_file_path ON projects(catalog_file_path);
