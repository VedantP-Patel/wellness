// src/hooks/useWeather.ts
"use client";

import { useState, useEffect } from "react";

interface WeatherData {
  temp: number;
  humidity: number;
  condition: string;
  icon: string;
}

export function useWeather(city?: string) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async (lat?: number, lon?: number) => {
    try {
      setLoading(true);
      let url = "/api/weather?";
      if (lat && lon) url += `lat=${lat}&lon=${lon}`;
      else if (city) url += `city=${encodeURIComponent(city)}`;
      else {
        setError("No location provided");
        setLoading(false);
        return;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data: WeatherData = await res.json();
        setWeather(data);
        setError(null);
      } else {
        setError("Failed to load weather");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try geolocation first, fallback to city if provided
    if ("geolocation" in navigator && !city) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Geolocation denied, use city if available
          if (city) fetchWeather();
          else setError("Location denied");
          setLoading(false);
        }
      );
    } else {
      fetchWeather();
    }

    // Refresh every 60 minutes
    const interval = setInterval(() => {
      fetchWeather();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [city]);

  return { weather, loading, error };
}