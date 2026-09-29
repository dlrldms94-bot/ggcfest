function readReservationForm(form) {
  const data = new FormData(form);
  const year = String(data.get("birthYear") || "").trim();
  const month = String(data.get("birthMonth") || "").trim();
  const dayPart = String(data.get("birthDay") || "").trim();
  let birth = "";
  if (year && month && dayPart) {
    birth =
      year +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(dayPart).padStart(2, "0");
  }
  return {
    name: String(data.get("name") || "").trim(),
    phone: data.get("phone"),
    birth: birth,
    day: String(data.get("day") || "").trim(),
    program: String(data.get("program") || "").trim(),
  };
}
