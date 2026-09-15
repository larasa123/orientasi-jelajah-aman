import { Text } from "react-native";
import { LaporanUdara } from "../types/cuaca";

interface IndikatorAQIProps {
  data: LaporanUdara;
}

export default function IndikatorAQI({ data }: IndikatorAQIProps) {
  const warna =
    data.tingkat === "BAIK"
      ? "green"
      : data.tingkat === "SEDANG"
        ? "orange"
        : data.tingkat === "TIDAK_SEHAT"
          ? "red"
          : "purple";

  return (
    <Text style={{ color: warna, fontSize: 18, fontWeight: "bold" }}>
      {data.kota} - AQI {data.indeksAQI} ({data.tingkat})
    </Text>
  );
}