import { ProjectConfigBalancer } from './projects/balancer'
import { ProjectConfig } from './config.types'

const PROJECT_CONFIGS = {
  [ProjectConfigBalancer.projectId]: ProjectConfigBalancer,
}

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID as ProjectConfig['projectId']

export const isBalancer = projectId === ProjectConfigBalancer.projectId
export const isBeets = false
export const PROJECT_CONFIG = PROJECT_CONFIGS[projectId] ?? ProjectConfigBalancer
