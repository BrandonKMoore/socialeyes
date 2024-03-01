const express = require('express');
const {  requireAuth, authenticationCheck } = require('../../utils/auth');
const { Op, json } = require('sequelize');

const { Event, Group, Venue, User, EventImage, Membership, Attendance } = require('../../db/models');
const attendance = require('../../db/models/attendance');

const router = express.Router();

// Get all Events
router.get('/', async(req, res, next)=>{
  const allEvents = await Event.findAll({
    include: [
      {model: Group, attributes: ['id', 'name', 'city', 'state']},
      {model: Venue, attributes: ['id', 'city', 'state']}],
    attributes: {
      exclude: ['description']
    }
  })

  res.json({Events: allEvents})
})

// Get details of an Event specified by its id
router.get('/:eventId', async(req, res, next)=>{
  const event = await Event.findByPk(req.params.eventId, {
    include: [
      {
        model: Group,
        attributes: ['id', 'name', 'private', 'city', 'state'],
      },
      {
        model: User,
        attributes: ['id'],
      },
      {
        model: EventImage,
        attributes: ['id', 'url', 'preview']
      },
      {
        model: Venue,
        attributes: {
          exclude: ['groupId', 'createdAt', 'updatedAt']
        }
      },
    ],
  })

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const { id, groupId, venueId, name, description, type, capacity, price, startDate, endDate } = event
  const eventRes = { id, groupId, venueId, name, description, type, capacity, price, startDate, endDate }
  eventRes.numAttending = event.Users.length
  eventRes.Group = event.Group
  eventRes.Venue = event.Venue
  eventRes.EventImages = event.EventImages

  res.json(eventRes)
});

// Add an Image to an Event based on the Event's id
router.post('/:eventId/images', requireAuth, async(req, res, next)=>{
  const event = await Event.findByPk(req.params.eventId, {
    include: [
      {
        model: Group,
        attributes: ['id', 'organizerId'],
      },
      {
        model: User,
        attributes: ['id'],
      },
      {
        model: EventImage,
        attributes: ['id', 'url', 'preview']
      },
      {
        model: Venue,
        attributes: {
          exclude: ['groupId', 'createdAt', 'updatedAt']
        }
      },
    ],
  });

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const member = await Membership.findOne({
    where: {
      groupId: event.groupId,
      userId: req.user.id
    }
  })
  const attendee = await Attendance.findOne({
    where: {
      eventId: event.id,
      userId: req.user.id
    }
  })

  // Authorazation: Current User must be an attendee, host, or co-host of the event
  if(!authenticationCheck(req.user.id, event.Group.organizerId) && !member && !attendee){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  } else if (member){
    if (member.status !== 'co-host'){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
    }
  } else if (attendee){
    if (attendee.status !== 'Going'){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
    }
  }

  const newEventImage = await event.createEventImage(req.body);
  const { id, url, preview } = newEventImage;
  res.json({
    id,
    url,
    preview
  })
});

// Edit an Event specified by its id
router.put('/:eventId', requireAuth, async(req, res, next)=>{

  const event = await Event.findByPk(req.params.eventId, {
    include: [
      {
        model: Group,
        attributes: ['organizerId']
      }
    ]
  })

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const member = await Membership.findOne({
    where: {
      groupId: event.groupId,
      userId: req.user.id
    }
  })

  //Authorization: Current User must be the organizer of the group or a member of the group with a status of "co-host"
  if(!authenticationCheck(req.user.id, event.Group.organizerId) && !member){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  } else if (member){
    if (member.status !== 'co-host'){
      const err = new Error("Forbidden")
      err.status = 403
      return next(err)
    }
  }

  if(!await Venue.findByPk(50)){
    err = new Error("Venue couldn't be found")
    err.status = 404
    return next(err)
  }

  for (let key in req.body){
    event[key] = req.body[key]
  }

  await event.save()

  const { id, groupId, venueId, name, type, capacity, price, description, startDate, endDate } = event
  const eventRes = { id, groupId, venueId, name, type, capacity, price, description, startDate, endDate }
res.json(eventRes)
});

router.delete('/:eventId', requireAuth, async(req, res, next)=>{
  const event = await Event.findByPk(req.params.eventId, {
    include: {model: Group, attributes: ['organizerId']}
  })

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

const member = await Membership.findOne({
  where: {
    groupId: event.groupId,
    userId: req.user.id
  }
})

  //Authorization: Current User must be the organizer of the group or a member of the group with a status of "co-host"
  if(!authenticationCheck(req.user.id, event.Group.organizerId) && !member){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  } else if (member){
    if (member.status !== 'co-host'){
      const err = new Error("Forbidden")
      err.status = 403
      return next(err)
    }
  }

  console.log('before', event.id)

  await Event.destroy({
    where: {
      id: event.id
    }
  })

  console.log('after', event.id)
  res.json({"message": "Successfully deleted"})
});

// Get all Attendees of an Event specified by its id
router.get('/:eventId/attendees', async(req, res, next)=>{
  const eventId = req.params.eventId;
  const allAttendees = await Event.findByPk(eventId, {
    include: [{
      model: User,
      attributes: ['id', 'firstName', 'lastName'],
      through: {
        attributes: ['status']
      }
    },
    {
      model: Group,
      attributes: ['id', 'organizerId']
    }],
    attributes: []
  })

  if(!allAttendees) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const coHostOfGroup = await Membership.findOne({
    where: {
      userId: req.user.id,
      groupId: allAttendees.Group.id,
      status: 'co-host'
    }
  })

  if(!authenticationCheck(req.user.id, allAttendees.Group.organizerId) && !coHostOfGroup){
    const attendeesLimited = []

    for (let attendee of allAttendees.Users){
      if(attendee.Attendance.status !== 'pending') attendeesLimited.push(attendee)
    }

    return res.json({Attendees: attendeesLimited})
  }

  res.json({Attendees: allAttendees.Users})
})

// Request to Attend an Event based on the Event's id
router.post('/:eventId/attendance', requireAuth, async(req, res, next)=>{
  const eventId = req.params.eventId
  const { userId, status } = req.body

  const event = await Event.findByPk(eventId)

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const attendee = await Attendance.findOne({
    where: {
      userId,
      eventId
    }
  })

  if(attendee){
    const err = new Error("Attendee already in attendance")
    if(attendee.status === 'pending') err.message = "Attendance has already been requested"
    if(attendee.status === 'attending') err.message = "User is already an attendee of the event"
    err.status = 400
    return next(err)
  }

  const member = await Membership.findOne({
    where: {
      groupId: event.groupId,
      userId
    }
  })

  if(!member){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  }

  try{
    const newAttendee = await Attendance.create({
      userId,
      eventId,
      status: 'pending'
    })
  } catch(err){
    next(err)
  }
  res.json({ userId, status })
});

// Change the status of an attendance for an event specified by id
router.put('/:eventId/attendance', requireAuth, async(req, res, next)=>{
  const eventId = req.params.eventId;
  const { userId, status } = req.body;

  const event = await Event.findByPk(eventId,{
    include: [{model: Group, attributes: ['organizerId']}]
  })

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  const coHostOfGroup = await Membership.findOne({
    where: {
      userId: req.user.id,
      groupId: event.groupId,
      status: 'co-host'
    }
  })

  if(!authenticationCheck(req.user.id, event.Group.organizerId) && !coHostOfGroup){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  }

  if(status === 'pending'){
    const err = new Error("Bad Request")
    err.errors = { status: "Cannot change an attendance status to pending" }
    err.status = 400
    return next(err)
  }

  //Couldn't find a User with the specified userId
  const user = await User.findByPk(userId)
  if(!user){
    const err = new Error("User couldn't be found")
    err.status = 404
    return next(err)
  }



  const attendee = await Attendance.findOne({ where: { userId, eventId }, attributes: {include:  ['id']}})

  if(!attendee) {
    const err = new Error("Attendance between the user and the event does not exist")
    err.status = 404
    return next(err)
  }

  attendee.status = status
  await attendee.save()



  res.json({
    id: attendee.id,
    eventId: attendee.eventId,
    userId: attendee.userId,
    status: attendee.status,
  })
});

// Delete attendance to an event specified by id
router.delete('/:eventId/attendance/:userId', requireAuth, async(req, res, next)=>{
  const { eventId, userId } = req.params

  const event = await Event.findByPk(eventId,{
    include: [{model: Group, attributes: ['organizerId']}]
  })

  if(!event) {
    const err = new Error("Event couldn't be found")
    err.status = 404
    return next(err)
  }

  //Couldn't find a User with the specified userId
  const user = await User.findByPk(userId)
  if(!user){
    const err = new Error("User couldn't be found")
    err.status = 404
    return next(err)
  }

  console.log(userId, userId == req.user.id, req.user.id)

  if(!authenticationCheck(req.user.id, event.Group.organizerId) && !(userId == req.user.id)){
    const err = new Error("Forbidden")
    err.status = 403
    return next(err)
  }

  const attendant = await Attendance.findOne({ where: { eventId, userId }})
  if(!attendant){
    const err = new Error("Attendance does not exist for this User")
    err.status = 404
    return next(err)
  }


  await Attendance.destroy({ where: { eventId, userId }})

  res.json({ message: "Successfully deleted attendance from event" })
})

module.exports = router;
