import SingleStepTile from './SingleStepTile'
import MultiStepTile from './MultiStepTile'
import type { DashboardTask } from '../../../types'

type TaskTileProps = DashboardTask & { color: string; memberId: string }

const TaskTile = (props: TaskTileProps) =>
  props.kind === 'single' ? <SingleStepTile {...props} /> : <MultiStepTile {...props} />

export default TaskTile
