/**
 * Resolves a free-text address to coordinates via OpenStreetMap's Nominatim.
 *
 * Only ever call this on a cache miss — `Location` rows are keyed by address
 * and reused — because Nominatim's usage policy caps unauthenticated callers at
 * roughly one request per second and requires the identifying `User-Agent`
 * sent below. A caller resolving several addresses in a row (the event
 * importer) has to space them out itself; see `GEOCODE_INTERVAL_MS`.
 *
 * Returns null instead of throwing on any failure; the caller decides whether a
 * missing geocode is fatal.
 */
export interface GeocodedLocation {
  latitude: number
  longitude: number
  address: string
}

/** The gap Nominatim's usage policy asks for between consecutive requests. */
export const GEOCODE_INTERVAL_MS = 1100

export async function geocodeLocation(location: string): Promise<GeocodedLocation | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
      {
        headers: {
          'User-Agent': 'Abide-Connect/1.0',
        },
      },
    )

    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`)
      return null
    }

    const results = await response.json()

    if (results.length === 0) {
      console.warn(`No geocoding results found for: ${location}`)
      return null
    }

    const topResult = results[0]

    return {
      latitude: parseFloat(topResult.lat),
      longitude: parseFloat(topResult.lon),
      address: location,
    }
  }
  catch (error) {
    console.error('❌ Geocoding error:', error)
    return null
  }
}
