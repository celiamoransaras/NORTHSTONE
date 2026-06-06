import WellnessCheckin from '../components/progress/WellnessCheckin'
import StatsGrid from '../components/progress/StatsGrid'
import LoadChart from '../components/progress/LoadChart'
import WellnessHistory from '../components/progress/WellnessHistory'
import GoalsSection from '../components/progress/GoalsSection'
import RecordsSection from '../components/progress/RecordsSection'

export default function Progress({ athleteId, sessions = [], isCoach = false }) {
  return (
    <div className="page fade-in">
      {!isCoach && <div className="page-header"><h2>Mi Progreso</h2></div>}
      <div className="page-content">
        {!isCoach && <WellnessCheckin athleteId={athleteId} />}
        {!isCoach && <StatsGrid athleteId={athleteId} sessions={sessions} />}
        <LoadChart sessions={sessions} />
        {!isCoach && <WellnessHistory athleteId={athleteId} />}
        <GoalsSection athleteId={athleteId} canCreate={isCoach} />
        <RecordsSection athleteId={athleteId} canEdit={!isCoach} />
      </div>
    </div>
  )
}
