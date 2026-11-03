"""dados/meta.json: what every page needs from the data (the partial year's last month)."""

from site_data.comum import LAST, partial_month, records, today, write_json


def build():
    write_json("meta.json", {"parcial": {"ano": LAST, "mes": partial_month(records())},
                             "gerado": today()})
