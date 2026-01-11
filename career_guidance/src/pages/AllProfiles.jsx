import { useState, useEffect } from 'react';
import './AllProfile.css';

function AllProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllProfiles();
  }, []);

  const fetchAllProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://careerguidance-10.onrender.com/api/all-profiles');
      const data = await response.json();

      if (data.success) {
        setProfiles(data.profiles);
      } else {
        setError(data.error || 'Failed to fetch profiles');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profiles-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profiles-container">
        <div className="error-state">
          <p className="error-text">{error}</p>
          <button className="btn-retry" onClick={fetchAllProfiles}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profiles-container">
      <div className="profiles-content">
        <div className="profiles-header">
          <h1>All Stored Profiles ({profiles.length})</h1>
          <button className="btn-refresh" onClick={fetchAllProfiles}>
            Refresh
          </button>
        </div>

        {profiles.length === 0 ? (
          <p className="no-profiles">No profiles found in Cloudinary</p>
        ) : (
          <div className="profiles-list">
            {profiles.map((profile, index) => (
              <div key={index} className="profile-card">
                <div className="profile-card-content">
                  <div className="profile-info">
                    <div className="profile-title">
                      <span className="badge">Profile {index + 1}</span>
                      <span className="file-name">{profile.fileName}</span>
                    </div>
                    
                    <p className="profile-detail">
                      Size: {(profile.bytes / 1024).toFixed(2)} KB
                    </p>
                    
                    <p className="profile-detail created-at">
                      Created: {new Date(profile.createdAt).toLocaleString()}
                    </p>
                    
                    <p className="profile-path" title={profile.public_id}>
                      Path: {profile.public_id}
                    </p>
                  </div>

                  <button 
                    className="btn-view"
                    onClick={() => window.open(profile.url, '_blank')}
                  >
                    View JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AllProfiles;
