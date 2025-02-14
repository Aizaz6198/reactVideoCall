import { io } from "socket.io-client";

const URL = "http://localhost:5000";
// const URL = "";

export const socket = io(URL);
export const navbarBrand = "Video Call App";
