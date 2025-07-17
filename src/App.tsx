import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Filter, Loader2, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// Material UI imports
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

const TEST_MODE = false; // Set to true to enable sample data for testing only

declare global {
  interface Window {
    parkrun?: any;
  }
}

const fuzzyMatch = (input: string, target: string) => {
  if (!input || !target) return false;
  const pattern = input.split('').map((c: string) => c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('.*?');
  const regex = new RegExp(pattern, 'i');
  return regex.test(target);
};

const ParkrunApp = () => {
  const [parkruns, setParkruns] = useState<any[]>([]);
  const [filteredParkruns, setFilteredParkruns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [letterFilter, setLetterFilter] = useState<string[]>([]);
  const [letterInput, setLetterInput] = useState('');
  const [radiusFilter, setRadiusFilter] = useState(''); // '' means 'No limit' by default
  const [searchAddress, setSearchAddress] = useState('');
  const [centerLat, setCenterLat] = useState(51.5074); // Default to central London
  const [centerLng, setCenterLng] = useState(-0.1278);
  const [searchTerm, setSearchTerm] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showRegular, setShowRegular] = useState(true);
  const [showJunior, setShowJunior] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const [lastSearchedAddress, setLastSearchedAddress] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Load parkrun data from remote JSON endpoint with caching
  useEffect(() => {
    const CACHE_KEY = 'parkrun_events_cache_v1';
    const CACHE_TIME_KEY = 'parkrun_events_cache_time_v1';
    // const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
    const CACHE_TTL_MS = 100;

    const loadParkrunData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Check cache
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();
        if (cached && cachedTime && now - parseInt(cachedTime, 10) < CACHE_TTL_MS) {
          const data = JSON.parse(cached);
          setParkruns(data);
          setLoading(false);
          return;
        }
        // Fetch from API
        const response = await fetch('https://images.parkrun.com/events.json');
        if (!response.ok) throw new Error('Failed to load events data');
        const data = await response.json();

        if (
          data &&
          data.events &&
          data.events.type === 'FeatureCollection' &&
          Array.isArray(data.events.features)
        ) {
          const transformedData = data.events.features.map((feature: any, index: number) => ({
            id: feature.id || index + 1,
            eventname: feature.properties?.eventname,
            eventLongName: feature.properties?.EventLongName,
            eventShortName: feature.properties?.EventShortName,
            name: feature.properties?.EventShortName, // for backward compatibility, but use eventShortName in UI
            location: feature.properties?.EventLocation,
            lat: feature.geometry?.coordinates?.[1] || 0,
            lng: feature.geometry?.coordinates?.[0] || 0,
            country: feature.properties?.countrycode || 'UK',
            url: feature.properties?.url || null
          }));

          if (!transformedData || transformedData.length === 0) {
            console.warn('Transformed parkrun data is empty!', { features: data.events.features, data });
          }
          setParkruns(transformedData);
          // Save to cache
          localStorage.setItem(CACHE_KEY, JSON.stringify(transformedData));
          localStorage.setItem(CACHE_TIME_KEY, now.toString());
        } else {
          console.error('Unknown events data structure:', data);
          setError('Unknown events data structure.');
          setParkruns([]);
        }
      } catch (error: any) {
        setError('Failed to load parkrun data: ' + error.message);
        setParkruns([]);
        console.error('Failed to load or transform parkrun data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadParkrunData();
  }, []);

  const loadSampleData = () => {
    // Enhanced sample data with real parkrun locations
    const sampleData = [
      { id: 1, name: "Bushy Park", location: "Teddington", lat: 51.4240, lng: -0.3370, country: "England" },
      { id: 2, name: "Clapham Common", location: "London", lat: 51.4634, lng: -0.1378, country: "England" },
      { id: 3, name: "Richmond Park", location: "London", lat: 51.4479, lng: -0.2649, country: "England" },
      { id: 4, name: "Hampstead Heath", location: "London", lat: 51.5559, lng: -0.1649, country: "England" },
      { id: 5, name: "Greenwich Park", location: "London", lat: 51.4777, lng: -0.0015, country: "England" },
      { id: 6, name: "Battersea Park", location: "London", lat: 51.4751, lng: -0.1551, country: "England" },
      { id: 7, name: "Dulwich Park", location: "London", lat: 51.4478, lng: -0.0877, country: "England" },
      { id: 8, name: "Finsbury Park", location: "London", lat: 51.5731, lng: -0.1063, country: "England" },
      { id: 9, name: "Ally Pally", location: "London", lat: 51.5950, lng: -0.1195, country: "England" },
      { id: 10, name: "Brockwell Park", location: "London", lat: 51.4534, lng: -0.1089, country: "England" },
      { id: 11, name: "Crystal Palace Park", location: "London", lat: 51.4180, lng: -0.0752, country: "England" },
      { id: 12, name: "Hackney Marshes", location: "London", lat: 51.5498, lng: -0.0234, country: "England" },
      { id: 13, name: "Southwark Park", location: "London", lat: 51.4974, lng: -0.0507, country: "England" },
      { id: 14, name: "Tooting Bec Common", location: "London", lat: 51.4435, lng: -0.1561, country: "England" },
      { id: 15, name: "Wandsworth Common", location: "London", lat: 51.4555, lng: -0.1742, country: "England" },
      { id: 16, name: "Wimbledon Common", location: "London", lat: 51.4364, lng: -0.2292, country: "England" },
      { id: 17, name: "Ashford", location: "Kent", lat: 51.1464, lng: 0.8750, country: "England" },
      { id: 18, name: "Brighton & Hove", location: "Brighton", lat: 50.8225, lng: -0.1372, country: "England" },
      { id: 19, name: "Canterbury", location: "Kent", lat: 51.2802, lng: 1.0789, country: "England" },
      { id: 20, name: "Edinburgh", location: "Edinburgh", lat: 55.9533, lng: -3.1883, country: "Scotland" },
      { id: 21, name: "Glasgow", location: "Glasgow", lat: 55.8642, lng: -4.2518, country: "Scotland" },
      { id: 22, name: "Cardiff", location: "Cardiff", lat: 51.4816, lng: -3.1791, country: "Wales" },
      { id: 23, name: "Belfast", location: "Belfast", lat: 54.5973, lng: -5.9301, country: "Northern Ireland" },
      { id: 24, name: "Birmingham", location: "Birmingham", lat: 52.4862, lng: -1.8904, country: "England" },
      { id: 25, name: "Manchester", location: "Manchester", lat: 53.4808, lng: -2.2426, country: "England" },
      { id: 26, name: "Leeds", location: "Leeds", lat: 53.8008, lng: -1.5491, country: "England" },
      { id: 27, name: "Newcastle", location: "Newcastle", lat: 54.9783, lng: -1.6178, country: "England" },
      { id: 28, name: "Oxford", location: "Oxford", lat: 51.7520, lng: -1.2577, country: "England" },
      { id: 29, name: "Cambridge", location: "Cambridge", lat: 52.2053, lng: 0.1218, country: "England" },
      { id: 30, name: "Bath", location: "Bath", lat: 51.3758, lng: -2.3599, country: "England" },
      { id: 31, name: "Apley Woods", location: "Telford", lat: 52.6954, lng: -2.4417, country: "England" },
      { id: 32, name: "Banstead Woods", location: "Surrey", lat: 51.3208, lng: -0.2068, country: "England" },
      { id: 33, name: "Cannock Chase", location: "Staffordshire", lat: 52.7152, lng: -2.0264, country: "England" },
      { id: 34, name: "Delamere Forest", location: "Cheshire", lat: 53.2422, lng: -2.7285, country: "England" },
      { id: 35, name: "Epping Forest", location: "Essex", lat: 51.6459, lng: 0.0497, country: "England" },
      { id: 36, name: "Fountains Abbey", location: "Yorkshire", lat: 54.1116, lng: -1.5825, country: "England" },
      { id: 37, name: "Graves Park", location: "Sheffield", lat: 53.3498, lng: -1.4611, country: "England" },
      { id: 38, name: "Harrogate", location: "Yorkshire", lat: 53.9921, lng: -1.5360, country: "England" },
      { id: 39, name: "Ipswich", location: "Suffolk", lat: 52.0567, lng: 1.1482, country: "England" },
      { id: 40, name: "Jesmond Dene", location: "Newcastle", lat: 55.0065, lng: -1.6056, country: "England" },
      { id: 41, name: "Kedleston Park", location: "Derby", lat: 52.9178, lng: -1.4839, country: "England" },
      { id: 42, name: "Lancaster", location: "Lancashire", lat: 54.0465, lng: -2.8010, country: "England" },
      { id: 43, name: "Milton Keynes", location: "Buckinghamshire", lat: 52.0406, lng: -0.7594, country: "England" },
      { id: 44, name: "Northampton", location: "Northamptonshire", lat: 52.2405, lng: -0.9027, country: "England" },
      { id: 45, name: "Osterley", location: "London", lat: 51.4935, lng: -0.3469, country: "England" },
      { id: 46, name: "Preston Park", location: "Brighton", lat: 50.8496, lng: -0.1428, country: "England" },
      { id: 47, name: "Queen Elizabeth", location: "London", lat: 51.5434, lng: -0.0103, country: "England" },
      { id: 48, name: "Roundshaw Downs", location: "Surrey", lat: 51.3516, lng: -0.1430, country: "England" },
      { id: 49, name: "Shrewsbury", location: "Shropshire", lat: 52.7069, lng: -2.7516, country: "England" },
      { id: 50, name: "Telford", location: "Shropshire", lat: 52.6769, lng: -2.4447, country: "England" }
    ];
    setParkruns(sampleData);
  };

  // Geocode address using OpenStreetMap Nominatim (free service)
  const geocodeAddress = async (address: string) => {
    try {
      setGeocoding(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const location = data[0];
        setCenterLat(parseFloat(location.lat));
        setCenterLng(parseFloat(location.lon));
        return { lat: parseFloat(location.lat), lng: parseFloat(location.lon) };
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(`Geocoding error: ${error.message}`);
      } else {
        setError('Geocoding error: Unknown error');
      }
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddressSearch: (e: React.FormEvent<HTMLFormElement>) => Promise<void> = async (e) => {
    e.preventDefault();
    if (!searchAddress.trim()) return;
    
    setError(null);
    const result = await geocodeAddress(searchAddress);
    if (result) {
      setLastSearchedAddress(searchAddress);
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Filter parkruns based on criteria
  useEffect(() => {
    let filtered = parkruns;
    // Filter by regular/junior toggles
    filtered = filtered.filter(parkrun => {
      const isJunior = parkrun.name.toLowerCase().includes('junior') || parkrun.location.toLowerCase().includes('junior');
      if (isJunior && !showJunior) return false;
      if (!isJunior && !showRegular) return false;
      return true;
    });

    // Filter by first letter
    if (letterFilter.length > 0) {
      filtered = filtered.filter(parkrun => 
        letterFilter.includes(parkrun.name[0]?.toUpperCase())
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(parkrun => 
        parkrun.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        parkrun.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by radius
    if (radiusFilter && parseFloat(radiusFilter) > 0) {
      const radius = parseFloat(radiusFilter);
      filtered = filtered.filter(parkrun => {
        const distance = calculateDistance(centerLat, centerLng, parkrun.lat, parkrun.lng);
        return distance <= radius;
      });
    }

    // Sort by distance if radius filter is active
    filtered = filtered.slice();
      filtered.sort((a, b) => {
        const distanceA = calculateDistance(centerLat, centerLng, a.lat, a.lng);
        const distanceB = calculateDistance(centerLat, centerLng, b.lat, b.lng);
        return distanceA - distanceB;
      });

    setFilteredParkruns(filtered);
  }, [letterFilter, radiusFilter, centerLat, centerLng, searchTerm, parkruns, showRegular, showJunior]);

  // Fuzzy search for suggestions
  useEffect(() => {
    if (searchTerm.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      return;
    }
    const matches = parkruns.filter(p =>
      fuzzyMatch(searchTerm, p.name) || fuzzyMatch(searchTerm, p.location)
    ).slice(0, 8); // limit suggestions
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setActiveSuggestion(-1);
  }, [searchTerm, parkruns]);

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: any) => {
    setSearchTerm(suggestion.name);
    setShowSuggestions(false);
    setFilteredParkruns([suggestion]);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      setActiveSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        handleSuggestionClick(suggestions[activeSuggestion]);
      }
    }
  };

  // Prevent dropdown from closing when clicking a suggestion
  const handleSuggestionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Generate alphabet for letter filter
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  // Generate all unique first letters from parkruns, sorted
  const allLetters = Array.from(new Set(parkruns.map(p => p.name[0]?.toUpperCase()).filter(Boolean))).sort();

  // Helper to get event slug for URLs and email
  const getEventSlug = (parkrun: any) => {
    if (parkrun.eventname) {
      return parkrun.eventname.toLowerCase();
    }
    return '';
  };

  // Helper to get home image and photos URL
  const getHomeImageUrl = (parkrun: any) => {
    const slug = getEventSlug(parkrun);
    return `https://images.parkrun.com/event/${slug}/eventhomepagepicture.jpg`;
  };
  const getPhotosUrl = (parkrun: any) => {
    const slug = getEventSlug(parkrun);
    return `https://www.parkrun.org.uk/${slug}/photos/`;
  };

  const getParkrunUrl = (parkrun: any) => {
    if (parkrun.url) return parkrun.url;
    const slug = getEventSlug(parkrun);
    return `https://www.parkrun.org.uk/${encodeURIComponent(slug)}/`;
  };

  const getCourseUrl = (parkrun: any) => {
    const slug = getEventSlug(parkrun);
    return `https://www.parkrun.org.uk/${encodeURIComponent(slug)}/course/`;
  };

  const getVolunteerUrl = (parkrun: any) => {
    const slug = getEventSlug(parkrun);
    return `https://www.parkrun.org.uk/${encodeURIComponent(slug)}/futureroster/`;
  };

  const getEmail = (parkrun: any) => {
    const slug = getEventSlug(parkrun);
    return slug ? `${slug}@parkrun.com` : '';
  };

  // Parkrun color palette
  const PARKRUN_ORANGE = '#f58220';
  const PARKRUN_GREEN = '#00843d';
  const CARD_BG = 'bg-white';
  const CARD_SHADOW = 'shadow-lg';
  const CARD_BORDER = 'border border-gray-200';
  const ACCENT_BADGE = 'inline-block px-2 py-0.5 rounded-full text-xs font-semibold';

  // Custom marker icon (default Leaflet icon fix for React)
  const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41],
  });

  // Helper component to move and rescale the map on center/radius change
  function MapAutoFit({ centerLat, centerLng, radiusFilter }: { centerLat: number, centerLng: number, radiusFilter: string }) {
    const map = useMap();
    React.useEffect(() => {
      if (radiusFilter && parseFloat(radiusFilter) > 0) {
        const radius = parseFloat(radiusFilter);
        const latlng = [centerLat, centerLng] as [number, number];
        map.fitBounds([
          [centerLat + radius / 111, centerLng + radius / (111 * Math.cos(centerLat * Math.PI / 180))],
          [centerLat - radius / 111, centerLng - radius / (111 * Math.cos(centerLat * Math.PI / 180))],
        ], { padding: [40, 40] });
      } else {
        map.setView([centerLat, centerLng], 11, { animate: true });
      }
    }, [centerLat, centerLng, radiusFilter, map]);
    return null;
  }

  // Unified ParkrunInfo component for both map popup and list view
  const ParkrunInfo = ({ parkrun }: { parkrun: any }) => {
    const eventName = parkrun.eventShortName || parkrun.name;
    const address = `${parkrun.location}, ${parkrun.country}`;
    const googleMapsQuery = encodeURIComponent(parkrun.eventLongName || parkrun.eventShortName || parkrun.name);
    return (
      <div className="flex-1">
        <div className="mb-1" style={{ fontWeight: 700, fontSize: '1.2rem' }}>{eventName}</div>
        <div className="text-xs mb-1">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${googleMapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.25em' }}
          >
            <span role="img" aria-label="Location">📍</span> {address}
          </a>
        </div>
        <div className="space-y-1 text-xs text-gray-700 mt-2">
          <div className="flex items-center gap-1">
            <span>🏠</span>
            <a href={getParkrunUrl(parkrun)} target="_blank" rel="noopener noreferrer" className="underline text-blue-700 hover:text-blue-900">Home page</a>
          </div>
          <div className="flex items-center gap-1">
            <span>🏃‍♂️</span>
            <a href={getCourseUrl(parkrun)} target="_blank" rel="noopener noreferrer" className="underline text-green-700 hover:text-green-900">Course page</a>
          </div>
          <div className="flex items-center gap-1">
            <span>🙋</span>
            <a href={getVolunteerUrl(parkrun)} target="_blank" rel="noopener noreferrer" className="underline text-orange-600 hover:text-orange-800">Volunteering</a>
          </div>
          <div className="flex items-center gap-1">
            <span>✉️</span>
            <a href={`mailto:${getEmail(parkrun)}`} className="underline text-blue-600 hover:text-blue-800">{getEmail(parkrun)}</a>
          </div>
          <div className="flex items-center gap-1">
            <span>📊</span>
            <a href={`${getParkrunUrl(parkrun)}results/latestresults/`} target="_blank" rel="noopener noreferrer" className="underline text-purple-700 hover:text-purple-900">Latest results</a>
          </div>
          <div className="flex items-center gap-1">
            <span>📸</span>
            <a href={getPhotosUrl(parkrun)} target="_blank" rel="noopener noreferrer" className="underline text-pink-600 hover:text-pink-800">Photos</a>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading parkrun data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 p-4 font-sans">
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, maxWidth: 1400, mx: 'auto', gap: 4 }}>
        {/* Left: UI controls */}
        <Box sx={{ flex: '0 0 380px', maxWidth: 420, minWidth: 320, width: { xs: '100%', md: 380 }, mb: { xs: 4, md: 0 } }}>
          {/* Subtitle only, no 'parkrun alphabet' header */}
          <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 3 }}>
            {error && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffeaea', border: '1px solid #ffbdbd' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AlertCircle style={{ marginRight: 8, color: '#d32f2f' }} />
                  <Typography color="error">{error}</Typography>
                </Box>
              </Paper>
            )}
            {lastSearchedAddress && (
              <Typography variant="body2" sx={{ mb: 2 }}>
                Showing results for address: <b>{lastSearchedAddress}</b> — <b>{filteredParkruns.length}</b> parkruns found
              </Typography>
            )}
            {/* Address Search */}
            <Box component="form" onSubmit={handleAddressSearch} sx={{ mb: 3 }}>
              <TextField
                fullWidth
                variant="outlined"
                size="medium"
                label="Search by location"
                placeholder="Woolwich"
                value={searchAddress}
                onChange={e => setSearchAddress(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MapPin style={{ color: '#90a4ae' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2, bgcolor: 'white', borderRadius: 2 }}
              />
            </Box>
            {/* Search and Filters - now stacked vertically */}
            <Box sx={{ mb: 2 }}>
              {/* Parkrun Search with Suggestions */}
              <Autocomplete
                freeSolo
                options={parkruns.map(p => p.name)}
                inputValue={searchTerm}
                onInputChange={(_, value) => setSearchTerm(value)}
                renderInput={params => {
                  // Remove incompatible properties from params.InputProps
                  const filteredInputProps = Object.fromEntries(
                    Object.entries(params.InputProps).filter(
                      ([key]) => !['ref', 'className', 'endAdornment', 'onMouseDown'].includes(key)
                    )
                  );
                  return (
                    <TextField
                      {...params}
                      label="Search by name"
                      placeholder="Thames path"
                      variant="outlined"
                      InputProps={{
                        ...filteredInputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search style={{ color: '#90a4ae' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ bgcolor: 'white', borderRadius: 2 }}
                    />
                  );
                }}
                sx={{ minWidth: 220, width: '100%' }}
              />
            </Box>
            {/* Filters - now outside Paper, directly in main controls box */}
            <Box sx={{ mb: 2 }}>
              <TextField
                label="First letter(s)"
                value={letterInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
                  const unique = Array.from(new Set(val.split(''))).sort();
                  setLetterInput(unique.join(''));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setLetterFilter(letterInput.split(''));
                  }
                }}
                placeholder="ABC"
                variant="outlined"
                size="small"
                fullWidth
                sx={{ mb: 2, bgcolor: 'white', borderRadius: 2 }}
                inputProps={{ maxLength: 32, style: { fontFamily: 'monospace' } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <span style={{ fontWeight: 700, fontSize: 18, color: '#90a4ae' }}>A</span>
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0 }}>
                <Typography variant="body2" sx={{ minWidth: 90 }}>Radius (km):</Typography>
                <Slider
                  min={1}
                  max={200}
                  step={1}
                  value={radiusFilter && parseFloat(radiusFilter) > 0 ? Number(radiusFilter) : 200}
                  onChange={(_, value) => {
                    if (radiusFilter === '') {
                      setRadiusFilter(String(value));
                    } else {
                      setRadiusFilter(String(value));
                    }
                  }}
                  valueLabelDisplay="auto"
                  sx={{ flex: 1, color: '#2563eb' }}
                  disabled={radiusFilter === ''}
                />
                {radiusFilter && parseFloat(radiusFilter) > 0 && (
                  <Typography variant="body2" sx={{ ml: 2 }}>{radiusFilter} km</Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 1 }}>
                <ToggleButton
                  value="no-limit"
                  selected={radiusFilter === ''}
                  color="primary"
                  onChange={() => setRadiusFilter(radiusFilter === '' ? '10' : '')}
                  sx={{ px: 2, fontWeight: 600, textTransform: 'none' }}
                >
                  No limit
                </ToggleButton>
              </Box>
            </Box>
            {/* Legend/event type toggle FIRST */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="checkbox"
                  checked={showRegular}
                  onChange={() => setShowRegular(v => !v)}
                  style={{ accentColor: '#f58220', width: 18, height: 18, marginRight: 6 }}
                />
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: showRegular ? '#f58220' : '#fff', mr: 1, border: '2px solid #f58220', boxShadow: '0 1px 4px #0001', transition: 'background 0.2s', minWidth: 22, minHeight: 22 }} />
                <Typography variant="body2" sx={{ color: '#f58220', fontWeight: 600 }}>Regular parkrun</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="checkbox"
                  checked={showJunior}
                  onChange={() => setShowJunior(v => !v)}
                  style={{ accentColor: '#00843d', width: 18, height: 18, marginRight: 6 }}
                />
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: showJunior ? '#00843d' : '#fff', mr: 1, border: '2px solid #00843d', boxShadow: '0 1px 4px #0001', transition: 'background 0.2s', minWidth: 22, minHeight: 22 }} />
                <Typography variant="body2" sx={{ color: '#00843d', fontWeight: 600 }}>Junior parkrun</Typography>
              </Box>
            </Box>
            {/* Toggle View SECOND */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2, gap: 2 }}>
              <Button
                variant={viewMode === 'map' ? 'contained' : 'outlined'}
                color={viewMode === 'map' ? 'primary' : 'inherit'}
                onClick={() => setViewMode('map')}
                startIcon={<span role="img" aria-label="Map">🗺️</span>}
                sx={{ fontWeight: 600 }}
              >
                Map View
              </Button>
              <Button
                variant={viewMode === 'list' ? 'contained' : 'outlined'}
                color={viewMode === 'list' ? 'primary' : 'inherit'}
                onClick={() => setViewMode('list')}
                startIcon={<span role="img" aria-label="List">📋</span>}
                sx={{ fontWeight: 600 }}
              >
                List View
              </Button>
            </Box>
          </Box>
        </Box>
        {/* Right: Map/List view */}
        <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 'auto' }, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          {/* Results */}
          {viewMode === 'map' ? (
            <div className="bg-white rounded-lg shadow-md p-6" style={{ minHeight: '70vh', height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <MapContainer
                center={[centerLat, centerLng]}
                zoom={7}
                style={{ height: '100%', width: '100%', flex: 1 }}
                scrollWheelZoom={true}
              >
                <MapAutoFit centerLat={centerLat} centerLng={centerLng} radiusFilter={radiusFilter} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {/* Center marker and radius circle */}
                <Marker position={[centerLat, centerLng]} icon={L.divIcon({ className: '', html: `<span style=\"display:inline-block;width:20px;height:20px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);\"></span>`, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] })}>
                  <Popup>
                    <div className="font-semibold text-blue-700">Center<br/>{centerLat.toFixed(4)}, {centerLng.toFixed(4)}</div>
                  </Popup>
                </Marker>
                {radiusFilter && parseFloat(radiusFilter) > 0 && (
                  <Circle
                    center={[centerLat, centerLng]}
                    radius={parseFloat(radiusFilter) * 1000}
                    pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 2 }}
                  />
                )}
                  {filteredParkruns.map(parkrun => {
                  const isJunior = parkrun.name.toLowerCase().includes('junior') || parkrun.location.toLowerCase().includes('junior');
                  // Use a colored circle marker for junior/regular
                    return (
                    <Marker
                      key={parkrun.id}
                      position={[parkrun.lat, parkrun.lng]}
                      icon={L.divIcon({
                        className: '',
                        html: `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${isJunior ? PARKRUN_GREEN : PARKRUN_ORANGE};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></span>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 24],
                        popupAnchor: [0, -24],
                      })}
                    >
                      <Popup>
                        <div className="flex items-center">
                          <ParkrunInfo parkrun={parkrun} />
                          {/* <img src={getHomeImageUrl(parkrun)} alt="Event" className="w-12 h-12 object-cover rounded ml-2" /> */}
                        </div>
                      </Popup>
                    </Marker>
                    );
                  })}
              </MapContainer>
            </div>
          ) : (
            <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: '#fff', borderRadius: 3, boxShadow: 1, maxWidth: 700, mx: { xs: 'auto', md: 0 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                📋 List of Parkruns ({filteredParkruns.length})
              </Typography>
              {filteredParkruns.length === 0 ? (
                <Typography variant="body1">No parkruns found.</Typography>
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {filteredParkruns.map(parkrun => (
                    <Box component="li" key={parkrun.id} sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 2, bgcolor: '#fafbfc', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <ParkrunInfo parkrun={parkrun} />
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Box>
    </div>
  );
};

export default ParkrunApp;