#[derive(serde::Deserialize)]
pub struct SearchFlightsReq {
    pub origin: String,
    pub destination: String,
    pub departure_date: String,
    pub return_date: Option<String>,
    pub passengers: u32,
}

#[derive(serde::Serialize)]
pub struct FlightOffer {
    pub id: String,
    pub airline: String,
    pub flight_number: String,
    pub departure_time: String,
    pub arrival_time: String,
    pub total_amount: String,
    pub total_currency: String,
    pub passenger_ids: alloc::vec::Vec<alloc::string::String>,
}

#[derive(serde::Serialize)]
pub struct SearchFlightsResp {
    pub offers: Vec<FlightOffer>,
}

#[derive(serde::Deserialize)]
pub struct SearchHotelsReq {
    pub city: String,
    pub check_in: String,
    pub check_out: String,
    pub guests: u32,
}

#[derive(serde::Serialize)]
pub struct HotelOffer {
    pub id: String,
    pub name: String,
    pub room_type: String,
    pub total_amount: String,
    pub total_currency: String,
    pub guest_ids: alloc::vec::Vec<alloc::string::String>,
}

#[derive(serde::Serialize)]
pub struct SearchHotelsResp {
    pub offers: Vec<HotelOffer>,
}

const MOCK_API_BASE: &str = "https://api.terminal3.io";

pub fn search_flights(input: &[u8]) -> Result<Vec<u8>, String> {
    let _req: SearchFlightsReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("search-flights: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let resp = search_flights_wasm(_req)?;
        serde_json::to_vec(&resp).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = _req;
        Err("search_flights is only implemented on wasm32".to_string())
    }
}

pub fn search_hotels(input: &[u8]) -> Result<Vec<u8>, String> {
    let _req: SearchHotelsReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("search-hotels: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let resp = search_hotels_wasm(_req)?;
        serde_json::to_vec(&resp).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = _req;
        Err("search_hotels is only implemented on wasm32".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{http as http_iface, kv_store, logging},
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
fn search_flights_wasm(req: SearchFlightsReq) -> Result<SearchFlightsResp, String> {
    use serde_json::json;

    let api_key = get_api_key()?;

    let body = json!({
        "origin": req.origin,
        "destination": req.destination,
        "departure_date": req.departure_date,
        "return_date": req.return_date,
        "passengers": req.passengers,
    });

    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Post,
        url: alloc::format!("{MOCK_API_BASE}/travel/search-flights"),
        headers: Some(api_headers(&api_key)),
        payload: Some(serde_json::to_vec(&body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| alloc::format!("flight search: {e}"))?;

    if resp.code != 200 {
        return Err(alloc::format!("flight search failed: HTTP {}", resp.code));
    }

    let result: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| e.to_string())?;

    let _ = logging::info("flight search completed");

    let offers = result["offers"]
        .as_array()
        .ok_or("missing offers")?
        .iter()
        .map(|o| {
            Ok(FlightOffer {
                id: o["id"].as_str().ok_or("missing id")?.to_string(),
                airline: o["airline"].as_str().unwrap_or("").to_string(),
                flight_number: o["flight_number"].as_str().unwrap_or("").to_string(),
                departure_time: o["departure_time"].as_str().unwrap_or("").to_string(),
                arrival_time: o["arrival_time"].as_str().unwrap_or("").to_string(),
                total_amount: o["total_amount"].as_str().ok_or("missing total_amount")?.to_string(),
                total_currency: o["total_currency"].as_str().unwrap_or("USD").to_string(),
                passenger_ids: alloc::vec![],
            })
        })
        .collect::<Result<Vec<_>, alloc::string::String>>()?;

    Ok(SearchFlightsResp { offers })
}

#[cfg(target_arch = "wasm32")]
fn search_hotels_wasm(req: SearchHotelsReq) -> Result<SearchHotelsResp, String> {
    use serde_json::json;

    let api_key = get_api_key()?;

    let body = json!({
        "city": req.city,
        "check_in": req.check_in,
        "check_out": req.check_out,
        "guests": req.guests,
    });

    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Post,
        url: alloc::format!("{MOCK_API_BASE}/travel/search-hotels"),
        headers: Some(api_headers(&api_key)),
        payload: Some(serde_json::to_vec(&body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| alloc::format!("hotel search: {e}"))?;

    if resp.code != 200 {
        return Err(alloc::format!("hotel search failed: HTTP {}", resp.code));
    }

    let result: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| e.to_string())?;

    let _ = logging::info("hotel search completed");

    let offers = result["offers"]
        .as_array()
        .ok_or("missing offers")?
        .iter()
        .map(|o| {
            Ok(HotelOffer {
                id: o["id"].as_str().ok_or("missing id")?.to_string(),
                name: o["name"].as_str().unwrap_or("").to_string(),
                room_type: o["room_type"].as_str().unwrap_or("").to_string(),
                total_amount: o["total_amount"].as_str().ok_or("missing total_amount")?.to_string(),
                total_currency: o["total_currency"].as_str().unwrap_or("USD").to_string(),
                guest_ids: alloc::vec![],
            })
        })
        .collect::<Result<Vec<_>, alloc::string::String>>()?;

    Ok(SearchHotelsResp { offers })
}

#[cfg(target_arch = "wasm32")]
fn get_api_key() -> Result<alloc::string::String, alloc::string::String> {
    let tid = tenant_context::tenant_did();
    let map_name = alloc::format!("z:{}:secrets", hex::encode(&tid));
    let bytes = kv_store::get(&map_name, b"travel_api_key")
        .map_err(|e| alloc::format!("kv read: {e}"))?
        .ok_or("travel_api_key not found in z:<tid>:secrets")?;
    alloc::string::String::from_utf8(bytes).map_err(|e| e.to_string())
}

#[cfg(target_arch = "wasm32")]
fn api_headers(
    api_key: &str,
) -> alloc::vec::Vec<(alloc::string::String, alloc::string::String)> {
    alloc::vec![
        ("Authorization".to_string(), alloc::format!("Bearer {api_key}")),
        ("Content-Type".to_string(), "application/json".to_string()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_flights_non_wasm_returns_err() {
        let input = serde_json::to_vec(&serde_json::json!({
            "origin": "JFK", "destination": "LHR",
            "departure_date": "2026-07-15", "passengers": 1,
        }))
        .unwrap();
        let result = search_flights(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("wasm32"));
    }

    #[test]
    fn search_flights_bad_input_returns_err() {
        let result = search_flights(b"not json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("bad input"));
    }
}
