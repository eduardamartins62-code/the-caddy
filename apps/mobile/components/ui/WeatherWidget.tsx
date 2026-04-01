import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
}

export default function WeatherWidget({ latitude, longitude, date }: WeatherWidgetProps) {
  const [weather, setWeather] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,precipitation_probability_max,windspeed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&start_date=${date}&end_date=${date}`
    )
      .then(r => r.json())
      .then(data => {
        if (data.daily) {
          setWeather({
            temp: Math.round(data.daily.temperature_2m_max[0]),
            rain: data.daily.precipitation_probability_max[0],
            wind: Math.round(data.daily.windspeed_10m_max[0]),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [latitude, longitude, date]);

  if (loading || !weather) return null;

  const getWeatherIcon = () => {
    if (weather.rain > 60) return '🌧️';
    if (weather.rain > 30) return '⛅';
    if (weather.wind > 20) return '🌬️';
    return '☀️';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{getWeatherIcon()}</Text>
      <Text style={styles.temp}>{weather.temp}°F</Text>
      <Text style={[styles.rain, weather.rain > 40 && styles.rainWarning]}>
        {weather.rain}% rain
      </Text>
      <Text style={[styles.wind, weather.wind > 20 && styles.windWarning]}>
        {weather.wind > 20 ? '⚠️ ' : ''}{weather.wind} mph
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 8,
  },
  icon: { fontSize: 24 },
  temp: { fontFamily: 'DMMono_400Regular', fontSize: 18, color: Colors.textPrimary },
  rain: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textSecondary },
  rainWarning: { color: Colors.warning },
  wind: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textSecondary },
  windWarning: { color: Colors.error },
});
