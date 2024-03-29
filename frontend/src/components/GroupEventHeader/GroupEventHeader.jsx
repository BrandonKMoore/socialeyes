import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import './GroupEventHeader.css'

export default function GroupEventHeader(){
  const [isEvent, setIsEvent] = useState()

  useEffect(() => {
    const test = document.querySelector('a.active')
    setIsEvent(test.innerText === 'Events' ? 'Events' : 'Groups')
  },[isEvent])

  return (
    <div className="small-page-container" id="event-group-header">
      <nav id="group-event-nav">
        <NavLink to='/events'><h2>Events</h2></NavLink>
        <NavLink to='/groups'><h2>Groups</h2></NavLink>
      </nav>
      <div>
        <h4>{isEvent} in SocialEyes</h4>
        <Outlet />
      </div>
    </div>
  )
}
