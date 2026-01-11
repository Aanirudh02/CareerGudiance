/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Award, 
  Clock, 
  Users, 
  Star, 
  ExternalLink, 
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  TrendingUp,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Calendar,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';

const Course = () => {
  const navigate = useNavigate();
  const [courseData, setCourseData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  useEffect(() => {
    // Load data from localStorage
    const analysisData = localStorage.getItem('courseAnalysisData');
    const profileData = localStorage.getItem('userProfileData');

    if (!analysisData || !profileData) {
      toast.error('No course data found. Please run analysis first.');
      navigate('/dashboard');
      return;
    }

    setCourseData(JSON.parse(analysisData));
    setUserProfile(JSON.parse(profileData));
  }, [navigate]);

  if (!courseData || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course recommendations...</p>
        </div>
      </div>
    );
  }

  const { coursesCategories, aiRecommendations, topRatedCourses, totalCourses } = courseData;

  // Filter courses
  const getFilteredCourses = () => {
    let courses = [];
    
    if (activeCategory === 'all') {
      courses = [
        ...coursesCategories.technical,
        ...coursesCategories.certifications,
        ...coursesCategories.softSkills,
        ...coursesCategories.careerDevelopment
      ];
    } else {
      courses = coursesCategories[activeCategory] || [];
    }

    // Apply search filter
    if (searchQuery) {
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply difficulty filter
    if (selectedDifficulty !== 'all') {
      courses = courses.filter(course =>
        course.difficulty.toLowerCase().includes(selectedDifficulty.toLowerCase())
      );
    }

    return courses;
  };

  const filteredCourses = getFilteredCourses();

  // Course Card Component
  const CourseCard = ({ course }) => {
    const isExpanded = expandedCourse === course.id;

    return (
      <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-purple-100">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2">
                {course.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-purple-600 font-medium">
                <Award className="w-4 h-4" />
                {course.provider}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">{course.rating > 0 ? course.rating.toFixed(1) : 'N/A'}</span>
              <span className="text-gray-400">({course.reviewCount})</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-blue-500" />
              {course.duration}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-green-500" />
              {course.enrollments > 0 ? `${(course.enrollments / 1000).toFixed(0)}k enrolled` : 'New'}
            </div>
          </div>

          {/* Description */}
          <p className={`text-gray-600 text-sm mb-4 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {course.description}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {course.difficulty}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              FREE
            </span>
            {course.startDate && course.startDate !== 'Anytime' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {course.startDate}
              </span>
            )}
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              {course.topics && course.topics.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Topics Covered:</p>
                  <div className="flex flex-wrap gap-2">
                    {course.topics.map((topic, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {course.skills && course.skills.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Skills You'll Gain:</p>
                  <div className="flex flex-wrap gap-2">
                    {course.skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center gap-2 text-sm"
            >
              Enroll Now
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
              className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition flex items-center gap-2 text-sm"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Less' : 'More'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-purple-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Personalized Course Recommendations
                </h1>
                <p className="text-gray-600 mt-1">
                  {totalCourses} FREE courses curated for {userProfile.fullName}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Technical Courses</p>
                <p className="text-2xl font-bold text-purple-700">{coursesCategories.technical.length}</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-4">
                <p className="text-sm text-pink-600 font-medium mb-1">Certifications</p>
                <p className="text-2xl font-bold text-pink-700">{coursesCategories.certifications.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Soft Skills</p>
                <p className="text-2xl font-bold text-blue-700">{coursesCategories.softSkills.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Career Dev</p>
                <p className="text-2xl font-bold text-green-700">{coursesCategories.careerDevelopment.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        {aiRecommendations && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-8 h-8" />
              <h2 className="text-2xl font-bold">AI-Powered Learning Path</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Immediate */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-6 h-6" />
                  <h3 className="text-xl font-bold">{aiRecommendations.learningPath.immediate.title}</h3>
                </div>
                <p className="text-purple-100 mb-4">⏱️ {aiRecommendations.learningPath.immediate.estimatedHours} hours</p>
                <ul className="space-y-2">
                  {aiRecommendations.learningPath.immediate.courses.slice(0, 3).map((course, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{course.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Short Term */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-6 h-6" />
                  <h3 className="text-xl font-bold">{aiRecommendations.learningPath.shortTerm.title}</h3>
                </div>
                <p className="text-purple-100 mb-4">⏱️ {aiRecommendations.learningPath.shortTerm.estimatedHours} hours</p>
                <ul className="space-y-2">
                  {aiRecommendations.learningPath.shortTerm.courses.slice(0, 3).map((course, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{course.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Long Term */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-6 h-6" />
                  <h3 className="text-xl font-bold">{aiRecommendations.learningPath.longTerm.title}</h3>
                </div>
                <p className="text-purple-100 mb-4">⏱️ {aiRecommendations.learningPath.longTerm.estimatedHours} hours</p>
                <ul className="space-y-2">
                  {aiRecommendations.learningPath.longTerm.courses.slice(0, 3).map((course, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{course.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Career Readiness */}
            <div className="mt-6 bg-white/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Career Readiness Score:</span>
                <span className="text-2xl font-bold">{aiRecommendations.careerReadiness}/100</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2 mt-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-500"
                  style={{ width: `${aiRecommendations.careerReadiness}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6 border border-purple-100">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical ({coursesCategories.technical.length})</option>
              <option value="certifications">Certifications ({coursesCategories.certifications.length})</option>
              <option value="softSkills">Soft Skills ({coursesCategories.softSkills.length})</option>
              <option value="careerDevelopment">Career Dev ({coursesCategories.careerDevelopment.length})</option>
            </select>

            {/* Difficulty Filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.length > 0 ? (
            filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No courses found matching your filters</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                  setSelectedDifficulty('all');
                }}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Course;