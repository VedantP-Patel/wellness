// src/app/api/weather/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key missing" }, { status: 500 });
  }

  let url: string;
  if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  } else if (city) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  } else {
    return NextResponse.json({ error: "city or lat/lon required" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Weather fetch failed" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({
      temp: data.main.temp,
      humidity: data.main.humidity,
      condition: data.weather[0]?.main || "Unknown",
      icon: data.weather[0]?.icon,
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}