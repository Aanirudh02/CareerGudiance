/* eslint-disable no-useless-escape */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import './Analysis.css';

export default function Analysis() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState(null);
  const [githubData, setGithubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    fetchProfileData();
  }, [currentUser, navigate]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`https://careerguidance-10.onrender.com/api/get-profile/${currentUser.email}`);
      const data = await response.json();
      
      if (data.exists && data.profile) {
        setProfileData(data.profile);
        setLoading(false);
        
        if (data.profile.githubUrl) {
          const username = extractGithubUsername(data.profile.githubUrl);
          if (username) {
            analyzeGithubProfile(username);
          }
        } else {
          setError('No GitHub URL found in your profile. Please add it in your profile settings.');
        }
      } else {
        setLoading(false);
        setError('Profile not found. Please complete your profile first.');
      }
    } catch (err) {
      setLoading(false);
      setError('Failed to load profile data');
      console.error(err);
    }
  };

  const extractGithubUsername = (url) => {
    const match = url.match(/github\.com\/([^\/]+)/);
    return match ? match[1] : null;
  };

  const analyzeGithubProfile = async (username) => {
    setAnalyzing(true);
    try {
      const response = await fetch('https://careerguidance-10.onrender.com/api/analyze-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          githubUsername: username,
          profileData: profileData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Full GitHub Data:', data);
        setGithubData(data);
      } else {
        setError(data.error || 'Failed to analyze GitHub profile');
      }
    } catch (err) {
      setError('Error analyzing GitHub profile');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="analysis-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-container">
        <div className="error-screen">
          <h2>⚠️ {error}</h2>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const analysis = githubData?.githubAnalysis;
  const aiRec = githubData?.aiRecommendations;

  // Prepare data for Radar Chart (Skill Strengths)
  const radarData = analysis?.skillStrengths ? [
    { skill: 'Frontend', value: analysis.skillStrengths.frontend, fullMark: 10 },
    { skill: 'Backend', value: analysis.skillStrengths.backend, fullMark: 10 },
    { skill: 'Database', value: analysis.skillStrengths.database, fullMark: 10 },
    { skill: 'DevOps', value: analysis.skillStrengths.devops, fullMark: 10 },
    { skill: 'Testing', value: analysis.skillStrengths.testing, fullMark: 10 }
  ] : [];

  // Prepare data for Pie Chart (Languages Distribution)
  const pieData = analysis?.languages ? 
    Object.entries(analysis.languages)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value })) 
    : [];

  const PIE_COLORS = ['#667eea', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <div className="analysis-container">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          Dashboard
        </span>
        <span> / </span>
        <span>GitHub Analysis</span>
      </div>

      {/* Header */}
      <div className="analysis-header">
        <div>
          <h1>🧠 GitHub Portfolio Intelligence</h1>
          <p>AI-powered analysis of your coding journey</p>
        </div>
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      {analyzing ? (
        <div className="analyzing-screen">
          <div className="spinner"></div>
          <h2>Analyzing your GitHub profile...</h2>
          <p>Deep scanning repositories, detecting frameworks, databases, and generating AI career insights...</p>
        </div>
      ) : (
        <>
          {analysis && (
            <>
              {/* Stats Grid */}
              <div className="stats-grid">
                <StatCard 
                  icon="📦" 
                  title="Public Repositories" 
                  value={analysis.stats?.publicRepos || 0}
                  color="#667eea"
                />
                <StatCard 
                  icon="⭐" 
                  title="Total Stars" 
                  value={analysis.stats?.totalStars || 0}
                  color="#f59e0b"
                />
                <StatCard 
                  icon="🔱" 
                  title="Total Forks" 
                  value={analysis.stats?.totalForks || 0}
                  color="#10b981"
                />
                <StatCard 
                  icon="👥" 
                  title="Followers" 
                  value={analysis.stats?.followers || 0}
                  color="#ef4444"
                />
              </div>

              {/* 🎯 HIRING READINESS HERO BANNER */}
              {analysis.hiringReadiness !== undefined && (
                <div className="section-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', textAlign: 'center' }}>
                  <h2 style={{ color: 'white', marginBottom: '20px' }}>🚀 Overall Hiring Readiness</h2>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '72px', fontWeight: 'bold', textShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
                        {analysis.hiringReadiness}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>Out of 100</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
                        {analysis.hiringLevel}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>
                        {analysis.hiringReadiness >= 75 ? '✅ Ready for mid-level roles' :
                         analysis.hiringReadiness >= 50 ? '⚡ Focus on portfolio projects' :
                         '📚 Build foundational projects first'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 📊 NEW: CHARTS SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* Skill Competency Radar Chart */}
                {radarData.length > 0 && (
                  <div className="section-card">
                    <h2>🎯 Skill Competency Radar</h2>
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis 
                          dataKey="skill" 
                          tick={{ fill: '#4a5568', fontSize: 14 }}
                        />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 10]} 
                          tick={{ fill: '#718096' }}
                        />
                        <Radar 
                          name="Skill Level" 
                          dataKey="value" 
                          stroke="#667eea" 
                          fill="#667eea" 
                          fillOpacity={0.6} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Language Distribution Pie Chart */}
                {pieData.length > 0 && (
                  <div className="section-card">
                    <h2>💻 Language Distribution</h2>
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Languages (keeping the bar version too) */}
              {analysis.languages && Object.keys(analysis.languages).length > 0 && (
                <div className="section-card">
                  <h2>💻 Programming Languages</h2>
                  <div className="languages-grid">
                    {Object.entries(analysis.languages).slice(0, 8).map(([lang, percentage]) => (
                      <LanguageBar key={lang} language={lang} percentage={percentage} />
                    ))}
                  </div>
                </div>
              )}

              {/* 🟢 SKILL STRENGTHS CARDS */}
              {analysis.skillStrengths && (
                <div className="section-card">
                  <h2>🟢 Your Strongest Skill Zones</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
                    <SkillCard title="Frontend Development" score={analysis.skillStrengths.frontend} />
                    <SkillCard title="Backend APIs" score={analysis.skillStrengths.backend} />
                    <SkillCard title="Database Design" score={analysis.skillStrengths.database} />
                    <SkillCard title="DevOps/Deployment" score={analysis.skillStrengths.devops} />
                    <SkillCard title="Testing & Quality" score={analysis.skillStrengths.testing} />
                  </div>
                </div>
              )}

              {/* Frontend/Backend Skills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {analysis.frontendSkills && analysis.frontendSkills.length > 0 && (
                  <div className="section-card">
                    <h2>🎨 Frontend Technologies</h2>
                    <div className="tech-badges">
                      {analysis.frontendSkills.map((skill, i) => (
                        <span key={i} className="tech-badge framework-badge">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.backendSkills && analysis.backendSkills.length > 0 && (
                  <div className="section-card">
                    <h2>⚙️ Backend Technologies</h2>
                    <div className="tech-badges">
                      {analysis.backendSkills.map((skill, i) => (
                        <span key={i} className="tech-badge database-badge">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Frameworks, Databases, Cloud */}
              {analysis.frameworks && analysis.frameworks.length > 0 && (
                <div className="section-card">
                  <h2>🚀 Frameworks & Libraries</h2>
                  <div className="tech-badges">
                    {analysis.frameworks.map((fw, i) => (
                      <span key={i} className="tech-badge framework-badge">{fw}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.databases && analysis.databases.length > 0 && (
                <div className="section-card">
                  <h2>🗄️ Databases Used</h2>
                  <div className="tech-badges">
                    {analysis.databases.map((db, i) => (
                      <span key={i} className="tech-badge database-badge">{db}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.cloudServices && analysis.cloudServices.length > 0 && (
                <div className="section-card">
                  <h2>☁️ Cloud & Deployment</h2>
                  <div className="tech-badges">
                    {analysis.cloudServices.map((cloud, i) => (
                      <span key={i} className="tech-badge cloud-badge">{cloud}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.buildTools && analysis.buildTools.length > 0 && (
                <div className="section-card">
                  <h2>🛠️ Build Tools & DevOps</h2>
                  <div className="tech-badges">
                    {analysis.buildTools.map((tool, i) => (
                      <span key={i} className="tech-badge tool-badge">{tool}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.projectTypes && analysis.projectTypes.length > 0 && (
                <div className="section-card">
                  <h2>📂 Project Categories</h2>
                  <div className="tech-badges">
                    {analysis.projectTypes.map((type, i) => (
                      <span key={i} className="tech-badge type-badge">{type}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Repositories */}
              {analysis.topRepos && analysis.topRepos.length > 0 && (
                <div className="section-card">
                  <h2>🏆 Top Repositories</h2>
                  <div className="repos-list">
                    {analysis.topRepos.map((repo, i) => (
                      <RepoCard key={i} repo={repo} />
                    ))}
                  </div>
                </div>
              )}

              {/* Commit Activity */}
              {analysis.commitActivity && (
                <div className="section-card">
                  <h2>📊 Commit Activity</h2>
                  <div className="activity-info">
                    <div className="activity-stat">
                      <span className="label">Average Commits/Week:</span>
                      <span className="value">{analysis.commitActivity.avgCommitsPerWeek || 0}</span>
                    </div>
                    <div className="activity-stat">
                      <span className="label">Total Commits Analyzed:</span>
                      <span className="value">{analysis.commitActivity.totalCommits || 0}</span>
                    </div>
                    <div className="activity-stat">
                      <span className="label">Consistency Score:</span>
                      <span className="value">{analysis.commitActivity.consistencyScore || 0}/10</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quality Metrics */}
              {analysis.qualityMetrics && (
                <div className="section-card">
                  <h2>✨ Portfolio Quality</h2>
                  <div className="activity-info">
                    <div className="activity-stat">
                      <span className="label">Avg README Score:</span>
                      <span className="value">{analysis.qualityMetrics.avgReadmeScore || 0}/10</span>
                    </div>
                    <div className="activity-stat">
                      <span className="label">Repos with README:</span>
                      <span className="value">{analysis.qualityMetrics.reposWithReadme || 0}</span>
                    </div>
                    <div className="activity-stat">
                      <span className="label">Repos with Stars:</span>
                      <span className="value">{analysis.qualityMetrics.reposWithStars || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔴 SKILL GAPS TABLE */}
              {analysis.skillGaps && analysis.skillGaps.length > 0 && (
                <div className="section-card">
                  <h2>🔴 Skill Gaps Blocking Your Hiring</h2>
                  <p style={{ color: '#718096', marginBottom: '20px' }}>These are critical skills missing from your portfolio that could limit job opportunities.</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Skill Area</th>
                          <th style={{ padding: '12px', textAlign: 'center' }}>Current</th>
                          <th style={{ padding: '12px', textAlign: 'center' }}>Ideal</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Why It Matters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.skillGaps.map((gap, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px', fontWeight: '600', color: '#2d3748' }}>{gap.skill}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '20px' }}>{gap.current}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '20px' }}>{gap.ideal}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ 
                                padding: '4px 12px', 
                                borderRadius: '12px', 
                                fontSize: '12px',
                                background: gap.priority === 'Critical' ? '#fee2e2' : gap.priority === 'High' ? '#fef3c7' : '#e0e7ff',
                                color: gap.priority === 'Critical' ? '#991b1b' : gap.priority === 'High' ? '#92400e' : '#3730a3'
                              }}>
                                {gap.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: '#4a5568', fontSize: '14px' }}>{gap.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 🚀 PROJECT RECOMMENDATIONS */}
              {analysis.projectRecommendations && analysis.projectRecommendations.length > 0 && (
                <div className="section-card">
                  <h2>🚀 Projects You Should Build Next</h2>
                  <p style={{ color: '#718096', marginBottom: '20px' }}>Based on your current skills and career goals, these projects will strengthen your portfolio.</p>
                  {analysis.projectRecommendations.map((project, i) => (
                    <div key={i} style={{ background: '#f7fafc', padding: '24px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#1a202c' }}>{project.title}</h3>
                        <span style={{ 
                          padding: '6px 12px', 
                          borderRadius: '20px', 
                          fontSize: '12px', 
                          fontWeight: 'bold',
                          background: project.difficulty === 'Advanced' ? '#fef3c7' : '#dbeafe',
                          color: project.difficulty === 'Advanced' ? '#92400e' : '#1e40af'
                        }}>
                          {project.difficulty}
                        </span>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <strong style={{ color: '#4a5568', fontSize: '14px' }}>Skills You'll Learn:</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {project.skills.map((skill, j) => (
                            <span key={j} className="tech-badge framework-badge" style={{ fontSize: '12px' }}>{skill}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <strong style={{ color: '#4a5568', fontSize: '14px' }}>Must Include:</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: '#2d3748' }}>
                          {project.mustInclude.map((item, j) => (
                            <li key={j} style={{ marginBottom: '4px' }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                        <strong style={{ color: '#92400e' }}>Why This Project?</strong>
                        <p style={{ margin: '8px 0 0 0', color: '#78350f' }}>{project.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ GITHUB IMPROVEMENT CHECKLIST */}
              {analysis.improvementChecklist && analysis.improvementChecklist.length > 0 && (
                <div className="section-card">
                  <h2>✅ GitHub Portfolio Improvement Checklist</h2>
                  <p style={{ color: '#718096', marginBottom: '20px' }}>Quick wins to make your GitHub profile more impressive to recruiters.</p>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {analysis.improvementChecklist.map((item, i) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px',
                        padding: '16px',
                        background: '#f7fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '24px', flexShrink: 0 }}>{item.status}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>{item.item}</div>
                          <div style={{ fontSize: '12px', color: '#718096' }}>Impact: {item.impact}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🤖 AI CAREER RECOMMENDATIONS */}
              {aiRec && (
                <>
                  <div className="section-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <h2 style={{ color: 'white' }}>🤖 AI Career Intelligence</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                          {aiRec.hiringReadiness}%
                        </div>
                        <div>Hiring Readiness</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                          {aiRec.frontendExpertise}/10
                        </div>
                        <div>Frontend Skills</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                          {aiRec.backendExpertise}/10
                        </div>
                        <div>Backend Skills</div>
                      </div>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div className="section-card">
                    <h2>💪 Your Coding Strengths</h2>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {aiRec.strengths.map((s, i) => (
                        <li key={i} style={{ padding: '12px', background: '#f0fdf4', margin: '8px 0', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                          ✓ {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Career Paths */}
                  <div className="section-card">
                    <h2>🎯 Recommended Career Paths</h2>
                    {aiRec.careerPaths.map((path, i) => (
                      <div key={i} style={{ background: '#f7fafc', padding: '20px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, color: '#667eea' }}>{path.role}</h3>
                          <span style={{ background: '#667eea', color: 'white', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' }}>
                            {path.match}% Match
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#4a5568', lineHeight: 1.6 }}>{path.reason}</p>
                      </div>
                    ))}
                  </div>

                  {/* Learning Path */}
                  <div className="section-card">
                    <h2>📚 What to Learn Next</h2>
                    <ol style={{ paddingLeft: '20px' }}>
                      {aiRec.learningPath.map((item, i) => (
                        <li key={i} style={{ padding: '10px 0', color: '#2d3748', lineHeight: 1.6 }}>{item}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Action Items */}
                  <div className="section-card">
                    <h2>✅ Portfolio Improvement Actions</h2>
                    <ol style={{ paddingLeft: '20px' }}>
                      {aiRec.actionItems.map((item, i) => (
                        <li key={i} style={{ padding: '10px 0', color: '#2d3748', lineHeight: 1.6 }}>{item}</li>
                      ))}
                    </ol>
                  </div>

                   {/* Focus Areas Timeline */}
                  {aiRec.focusAreas && (
                    <div className="section-card">
                      <h2>🎯 Focus Areas Timeline</h2>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                          <strong style={{ color: '#92400e', display: 'block', marginBottom: '8px' }}>⚡ Immediate (This Week):</strong>
                          <p style={{ margin: 0, color: '#78350f', lineHeight: 1.6 }}>{aiRec.focusAreas.immediate}</p>
                        </div>
                        <div style={{ padding: '16px', background: '#dbeafe', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                          <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '8px' }}>📅 Short-Term (This Month):</strong>
                          <p style={{ margin: 0, color: '#1e40af', lineHeight: 1.6 }}>{aiRec.focusAreas.shortTerm}</p>
                        </div>
                        <div style={{ padding: '16px', background: '#f3e8ff', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                          <strong style={{ color: '#5b21b6', display: 'block', marginBottom: '8px' }}>🚀 Long-Term (3-6 Months):</strong>
                          <p style={{ margin: 0, color: '#6b21a8', lineHeight: 1.6 }}>{aiRec.focusAreas.longTerm}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ==================== COMPONENTS ====================

function StatCard({ icon, title, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
}

function SkillCard({ title, score }) {
  const getColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    if (score >= 4) return '#ef4444';
    return '#9ca3af';
  };

  const getIcon = (score) => {
    if (score >= 8) return '🟢';
    if (score >= 6) return '🟡';
    if (score >= 4) return '🟠';
    return '🔴';
  };

  return (
    <div style={{ 
      padding: '20px', 
      background: '#fff', 
      borderRadius: '12px', 
      border: `2px solid ${getColor(score)}`,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{getIcon(score)}</div>
      <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '8px' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: getColor(score) }}>{score}</div>
        <div style={{ color: '#718096', fontSize: '14px' }}>/ 10</div>
      </div>
    </div>
  );
}

function LanguageBar({ language, percentage }) {
  return (
    <div className="language-item">
      <div className="language-header">
        <span className="language-name">{language}</span>
        <span className="language-percent">{percentage}%</span>
      </div>
      <div className="language-bar">
        <div className="language-fill" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function RepoCard({ repo }) {
  return (
    <div className="repo-card">
      <div className="repo-header">
        <h4>
          <a href={repo.url} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'none' }}>
            {repo.name}
          </a>
        </h4>
        <div className="repo-stats">
          <span>⭐ {repo.stars}</span>
          <span>🔱 {repo.forks}</span>
        </div>
      </div>
      <p className="repo-description">{repo.description || 'No description'}</p>
      <div className="repo-footer">
        <span className="repo-language">{repo.language || 'Unknown'}</span>
        <span className="repo-updated">Updated {repo.updated}</span>
      </div>
    </div>
  );
}
